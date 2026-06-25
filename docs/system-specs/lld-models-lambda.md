# LLD: Models Lambda

**Service:** Models Lambda (catalog proxy)
**Date:** 2026-06-24
**HLD ref:** `docs/system-specs/hld-modelarena.md` §3.2

---

## 1. API Contract

### GET /models

Proxies OpenRouter's model catalog with filtering, caching, and response reshaping.

**Query parameters:**

```typescript
interface ModelsQuery {
  search?: string;           // Fuzzy match on model name or ID
  max_price?: number;        // Max $/token for prompt pricing (e.g., 0.001)
  min_context?: number;      // Min context window (e.g., 32000)
  modality?: string;         // Filter by modality (e.g., "text+image->text")
  free_only?: boolean;       // Only return $0 models (shortcut for max_price=0)
  provider?: string;         // Filter by provider prefix (e.g., "anthropic", "openai")
  supports_tools?: boolean;  // Filter to models supporting tool_choice/tools
  sort_by?: "price_asc" | "price_desc" | "context_desc" | "name_asc"; // Default: name_asc
  limit?: number;            // Max results (default 50, max 200)
  offset?: number;           // Pagination offset (default 0)
}
```

**Response: 200 OK**

```typescript
interface ModelsResponse {
  models: ModelSummary[];
  total: number;             // Total matching models (before pagination)
  cached_at: string;         // ISO 8601 timestamp of cache refresh
}

interface ModelSummary {
  id: string;                // e.g., "anthropic/claude-opus-4.8"
  name: string;              // e.g., "Anthropic: Claude Opus 4.8"
  provider: string;          // e.g., "anthropic"
  context_length: number;
  max_completion_tokens: number | null;
  modality: string;          // e.g., "text+image->text"
  pricing: {
    prompt_per_million: number;      // $/1M tokens (converted from per-token)
    completion_per_million: number;
  };
  supports_tools: boolean;
  supports_streaming: boolean;
  is_free: boolean;
}
```

**Response: 400 Bad Request**

```typescript
interface ErrorResponse {
  error: string;             // Machine-readable code
  message: string;           // Human-readable description
}
```

| Status | Meaning |
|--------|---------|
| 200    | Success |
| 400    | Invalid query params (negative price, limit > 200, etc.) |
| 502    | OpenRouter API unreachable or returned error |
| 504    | OpenRouter API timeout (>10s) |

**CORS headers** (all responses):
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## 2. Database Schema

No database. In-memory cache only.

### Cache Design

```rust
struct ModelCache {
    models: Vec<OpenRouterModel>,   // Full catalog from OpenRouter
    fetched_at: Instant,            // When last refreshed
    ttl: Duration,                  // 5 minutes
}
```

**Cache strategy:**
- On cold start: fetch from OpenRouter, populate cache
- On warm invocation: if `Instant::now() - fetched_at > ttl`, re-fetch in background (serve stale)
- Cache lives in Lambda process memory — dies with the instance
- No cross-instance sharing (acceptable for POC — CloudFront caches 5 min anyway)

---

## 3. Component Design

### Module Structure

```
backend/models/
├── Cargo.toml
└── src/
    ├── main.rs              # Lambda handler entry point
    ├── openrouter.rs        # OpenRouter API client
    ├── cache.rs             # In-memory model cache
    ├── filter.rs            # Query parameter filtering logic
    └── types.rs             # Request/response types
```

### main.rs — Lambda Handler

```rust
// Entry: lambda_http::service_fn(handler)
// 1. Parse query params → ModelsQuery
// 2. Get models from cache (or fetch if stale/cold)
// 3. Apply filters (search, price, context, modality, provider, tools)
// 4. Apply sort
// 5. Apply pagination (offset, limit)
// 6. Map to ModelSummary (reshape OpenRouter response)
// 7. Return JSON with CORS headers
```

### openrouter.rs — API Client

```rust
pub struct OpenRouterClient {
    http: reqwest::Client,
    api_key: String,
    base_url: String,          // https://openrouter.ai/api/v1
}

impl OpenRouterClient {
    pub async fn fetch_models(&self) -> Result<Vec<OpenRouterModel>, OpenRouterError>;
}
```

- Single `reqwest::Client` reused across invocations (connection pooling)
- 10s timeout on OpenRouter calls
- API key from `OPENROUTER_API_KEY` env var

### cache.rs — In-Memory Cache

```rust
use std::sync::OnceLock;
use tokio::sync::RwLock;

static CACHE: OnceLock<RwLock<ModelCache>> = OnceLock::new();

pub async fn get_models(client: &OpenRouterClient) -> Result<Vec<OpenRouterModel>> {
    let cache = CACHE.get_or_init(|| RwLock::new(ModelCache::empty()));
    let read = cache.read().await;
    if read.is_fresh() {
        return Ok(read.models.clone());
    }
    drop(read);
    let mut write = cache.write().await;
    // Double-check after acquiring write lock
    if write.is_fresh() {
        return Ok(write.models.clone());
    }
    let models = client.fetch_models().await?;
    write.refresh(models.clone());
    Ok(models)
}
```

### filter.rs — Filtering Logic

```rust
pub fn apply_filters(models: &[OpenRouterModel], query: &ModelsQuery) -> Vec<OpenRouterModel> {
    models.iter()
        .filter(|m| match_search(m, &query.search))
        .filter(|m| match_max_price(m, query.max_price))
        .filter(|m| match_min_context(m, query.min_context))
        .filter(|m| match_modality(m, &query.modality))
        .filter(|m| match_provider(m, &query.provider))
        .filter(|m| match_free_only(m, query.free_only))
        .filter(|m| match_supports_tools(m, query.supports_tools))
        .cloned()
        .collect()
}
```

**Search matching:** Case-insensitive substring match on `id` and `name` fields. No fuzzy matching for POC.

---

## 4. Algorithm Details

### Price Conversion

OpenRouter returns pricing as string per-token (e.g., `"0.000005"`). Convert to per-million for readability:

```
price_per_million = parse_float(pricing.prompt) * 1_000_000
```

**Edge case:** Some models return `"0"` or `null` for pricing — treat as free (`0.0`).

### Search Matching

```
fn match_search(model, query) -> bool:
    if query is None: return true
    let q = query.to_lowercase()
    model.id.to_lowercase().contains(&q) || model.name.to_lowercase().contains(&q)
```

**Complexity:** O(N) scan over all models. N ≈ 300–500 models in OpenRouter catalog. Sub-millisecond.

---

## 5. Error Handling & Resilience

| Failure mode | Strategy |
|-------------|----------|
| OpenRouter API down | Return 502 with `{"error": "upstream_unavailable", "message": "..."}`. If cache has stale data, serve stale with `X-Cache-Stale: true` header. |
| OpenRouter API slow (>10s) | Timeout, return 504. Serve stale cache if available. |
| Invalid API key | OpenRouter returns 401. Return 502 (don't expose auth details). Log error. |
| Malformed OpenRouter response | Log parsing error. Return 502. |
| Invalid query params | Return 400 with specific validation error. |

**No retries:** Single attempt to OpenRouter. If it fails, serve stale or error. Models Lambda is not latency-critical enough to warrant retry complexity.

---

## 6. Test Plan

### Unit Tests

| Function | Test |
|----------|------|
| `filter::match_search` | Matches substring in id; matches in name; case-insensitive; returns all when query is None |
| `filter::match_max_price` | Filters above threshold; includes equal; handles free (0.0); handles None (no filter) |
| `filter::match_min_context` | Filters below threshold; handles None |
| `filter::apply_filters` | Composes multiple filters; empty result when nothing matches |
| `cache::is_fresh` | True when within TTL; false when expired; false when empty |
| `types::ModelSummary::from` | Converts OpenRouter format; price per-million math; handles null pricing; extracts provider from id |

### Integration Tests

| Test | Description |
|------|-------------|
| `handler_returns_models` | Mock OpenRouter response → verify 200 with correct ModelSummary shape |
| `handler_filters_by_price` | Mock catalog with mixed prices → verify max_price filter works |
| `handler_serves_stale_on_upstream_error` | Populate cache → simulate OpenRouter error → verify stale response with header |
| `handler_returns_502_on_cold_upstream_error` | Cold start + OpenRouter error → verify 502 |
| `handler_cors_headers` | Verify CORS headers present on all responses |

### Load Test Targets

Not applicable for POC. Lambda concurrency capped at 10.

# LLD: Orchestrator Lambda

**Service:** Benchmark Orchestrator Lambda (fan-out, judge, recommend)
**Date:** 2026-06-24
**HLD ref:** `docs/system-specs/hld-modelarena.md` §3.3, §3.4, §3.5

---

## 1. API Contract

### POST /benchmark

Accepts a benchmark configuration, fans out model calls, streams results via SSE.

**Request body:**

```typescript
interface BenchmarkRequest {
  system_prompt: string;                    // Max 10,000 chars
  test_cases: TestCase[];                   // 1–50 test cases
  models: string[];                         // 3–10 OpenRouter model IDs
  judge_models?: string[];                  // 1–3 free-tier model IDs (default: auto-select)
  rubric_criteria?: string[];               // Override default ["relevance", "accuracy", "completeness"]
}

interface TestCase {
  input: string;                            // Max 10,000 chars
  expected_output?: string;                 // Optional, max 10,000 chars
  label?: string;                           // Short description (e.g., "simple greeting", "code review")
}
```

**Validation rules:**

| Field | Rule |
|-------|------|
| `system_prompt` | Required, 1–10,000 chars |
| `test_cases` | Required, 1–50 items |
| `test_cases[].input` | Required, 1–10,000 chars |
| `test_cases[].expected_output` | Optional, max 10,000 chars |
| `test_cases[].label` | Optional, max 100 chars |
| `models` | Required, 3–10 items, each must be valid OpenRouter model ID format (`provider/model`) |
| `judge_models` | Optional, 1–3 items. Defaults to `["meta-llama/llama-4-maverick:free", "google/gemma-3-27b-it:free"]` |
| `rubric_criteria` | Optional, 1–5 items. Defaults to `["relevance", "accuracy", "completeness"]` |

**Response: SSE Stream (200 OK)**

Content-Type: `text/event-stream`

```typescript
// --- Progress events ---

interface BenchmarkStarted {
  event: "benchmark_started";
  data: {
    total_tasks: number;         // models.length × test_cases.length
    total_judge_tasks: number;   // total_tasks × judge_models.length
    estimated_cost_usd: number;  // Pre-calculated from model pricing
  };
}

interface ModelResult {
  event: "model_result";
  data: {
    model_id: string;
    test_case_idx: number;
    response: string;            // Full model response text
    latency_ms: number;          // Total request time
    ttfb_ms: number;             // Time to first byte
    tokens_in: number;           // Input tokens (from OpenRouter usage)
    tokens_out: number;          // Output tokens (from OpenRouter usage)
    cost_usd: number;            // Actual cost for this call
    completed: number;           // How many model tasks done so far
    total: number;               // Total model tasks
  };
}

interface JudgeResult {
  event: "judge_result";
  data: {
    model_id: string;
    test_case_idx: number;
    judge_model_id: string;
    scores: Record<string, number>;   // e.g., { relevance: 8, accuracy: 7, completeness: 9 }
    reasoning: string;
    completed: number;           // How many judge tasks done so far
    total: number;               // Total judge tasks
  };
}

interface Recommendation {
  event: "recommendation";
  data: {
    rankings: ModelRanking[];
    routing_policy: RoutingPolicy;
    summary: string;             // Human-readable recommendation
  };
}

interface ModelRanking {
  model_id: string;
  avg_quality: number;           // Average across all criteria and test cases (1-10)
  avg_latency_ms: number;
  total_cost_usd: number;
  cost_per_1k_tokens: number;    // Normalized cost metric
  composite_score: number;       // Weighted: 60% quality + 25% cost_efficiency + 15% speed
}

interface RoutingPolicy {
  primary_model: string;         // Best value model
  primary_traffic_pct: number;
  frontier_model: string;        // Best quality model
  frontier_traffic_pct: number;
  estimated_savings_pct: number;
  difficulty_threshold: DifficultySignal[];
  reasoning: string;
}

type DifficultySignal = "token_count" | "code_markers" | "math_markers" | "reasoning_markers" | "multi_constraint";

interface BenchmarkError {
  event: "error";
  data: {
    model_id?: string;
    test_case_idx?: number;
    judge_model_id?: string;
    error_code: string;          // "model_timeout" | "model_error" | "judge_parse_error" | "rate_limited"
    message: string;
  };
}

interface BenchmarkDone {
  event: "done";
  data: {};
}
```

**Error responses (non-streaming):**

| Status | When |
|--------|------|
| 400    | Invalid request body (validation failures) |
| 413    | Request body > 1 MB |
| 502    | OpenRouter API key invalid or all model calls failed |
| 504    | Lambda timeout (5 min exceeded) |

---

## 2. Database Schema

No database. All state in-memory during Lambda execution.

### In-Memory State

```rust
struct BenchmarkState {
    config: BenchmarkRequest,
    model_results: Vec<ModelResult>,         // Accumulated as they complete
    judge_results: Vec<JudgeResult>,         // Accumulated as they complete
    errors: Vec<BenchmarkError>,
    model_tasks_completed: AtomicU32,
    judge_tasks_completed: AtomicU32,
    pricing_cache: HashMap<String, ModelPricing>,  // model_id → pricing
}
```

---

## 3. Component Design

### Module Structure

```
backend/orchestrator/
├── Cargo.toml
└── src/
    ├── main.rs              # Lambda handler, SSE stream setup
    ├── openrouter.rs        # OpenRouter chat completions client
    ├── fanout.rs            # Concurrent model call fan-out
    ├── judge.rs             # Judge prompt construction + scoring
    ├── routing.rs           # Heuristic routing recommender
    ├── scoring.rs           # Score aggregation + ranking
    ├── sse.rs               # SSE event formatting + stream writer
    ├── validation.rs        # Request validation
    └── types.rs             # All type definitions
```

### main.rs — Lambda Streaming Handler

```rust
// Uses lambda_runtime::run_with_streaming_response
// NOT lambda_http — streaming requires the lower-level runtime API

async fn handler(event: LambdaEvent<ApiGatewayProxyRequest>) -> Result<StreamingResponse> {
    // 1. Parse + validate request body → BenchmarkRequest
    // 2. Fetch model pricing (for cost estimation + calculation)
    // 3. Create SSE stream (channel-based)
    // 4. Spawn benchmark pipeline as background task
    // 5. Return StreamingResponse wrapping the SSE receiver

    let (tx, rx) = tokio::sync::mpsc::channel::<SseEvent>(100);

    tokio::spawn(async move {
        run_benchmark(config, tx).await;
    });

    Ok(StreamingResponse::new(SseStream::new(rx)))
}

async fn run_benchmark(config: BenchmarkRequest, tx: Sender<SseEvent>) {
    // Phase 1: Fan out model calls
    // Phase 2: Fan out judge calls (as model results arrive)
    // Phase 3: Aggregate + recommend
    // Phase 4: Send done event
}
```

### openrouter.rs — Chat Completions Client

```rust
pub struct OpenRouterClient {
    http: reqwest::Client,
    api_key: String,
}

impl OpenRouterClient {
    pub async fn chat_completion(
        &self,
        model_id: &str,
        system_prompt: &str,
        user_input: &str,
    ) -> Result<CompletionResponse, OpenRouterError> {
        let start = Instant::now();

        let resp = self.http.post("https://openrouter.ai/api/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&ChatRequest {
                model: model_id,
                messages: vec![
                    Message { role: "system", content: system_prompt },
                    Message { role: "user", content: user_input },
                ],
            })
            .timeout(Duration::from_secs(120))
            .send()
            .await?;

        let latency_ms = start.elapsed().as_millis() as u64;
        let body: ChatResponse = resp.json().await?;

        Ok(CompletionResponse {
            content: body.choices[0].message.content.clone(),
            tokens_in: body.usage.prompt_tokens,
            tokens_out: body.usage.completion_tokens,
            latency_ms,
            ttfb_ms: 0, // TODO: measure from response headers
        })
    }

    pub async fn fetch_model_pricing(&self, model_ids: &[String]) -> Result<HashMap<String, ModelPricing>>;
}
```

**TTFB measurement:** For POC, we skip true TTFB (would require streaming the OpenRouter response). Use total latency only. TTFB is a v2 feature requiring SSE-to-SSE proxying.

### fanout.rs — Concurrent Model Calls

```rust
pub async fn fan_out_model_calls(
    client: &OpenRouterClient,
    config: &BenchmarkRequest,
    pricing: &HashMap<String, ModelPricing>,
    tx: &Sender<SseEvent>,
) -> Vec<ModelResultData> {
    let semaphore = Arc::new(Semaphore::new(20)); // Max 20 concurrent OpenRouter calls
    let counter = Arc::new(AtomicU32::new(0));
    let total = config.models.len() * config.test_cases.len();

    let mut handles = Vec::new();

    for (tc_idx, test_case) in config.test_cases.iter().enumerate() {
        for model_id in &config.models {
            let permit = semaphore.clone().acquire_owned().await.unwrap();
            let handle = tokio::spawn(async move {
                let result = client.chat_completion(model_id, &config.system_prompt, &test_case.input).await;
                drop(permit);

                match result {
                    Ok(resp) => {
                        let cost = calculate_cost(&resp, pricing.get(model_id));
                        let completed = counter.fetch_add(1, Ordering::Relaxed) + 1;
                        tx.send(SseEvent::ModelResult { ... }).await;
                        Some(ModelResultData { model_id, tc_idx, resp, cost })
                    }
                    Err(e) => {
                        tx.send(SseEvent::Error { ... }).await;
                        None
                    }
                }
            });
            handles.push(handle);
        }
    }

    let results: Vec<ModelResultData> = futures::future::join_all(handles)
        .await
        .into_iter()
        .filter_map(|r| r.ok().flatten())
        .collect();

    results
}
```

**Semaphore at 20:** OpenRouter rate limits vary by model and account. 20 concurrent requests is conservative. If we hit 429s, the per-request error handling catches it.

### judge.rs — Judge Scoring

```rust
const JUDGE_SYSTEM_PROMPT: &str = r#"You are an expert evaluator assessing LLM responses.
Score the response on each criterion using a 1-10 scale.
1 = completely fails, 5 = adequate, 10 = exceptional.

You MUST respond with ONLY valid JSON, no other text.
Format: {"scores": {"criterion_name": N, ...}, "reasoning": "one sentence"}"#;

fn build_judge_user_prompt(
    system_prompt: &str,
    test_input: &str,
    expected_output: Option<&str>,
    model_response: &str,
    criteria: &[String],
) -> String {
    let criteria_list = criteria.iter()
        .map(|c| format!("- {} (1-10)", c))
        .collect::<Vec<_>>()
        .join("\n");

    let expected = expected_output
        .map(|e| format!("\n\n## Expected Output\n{}", e))
        .unwrap_or_default();

    format!(
        "## Task System Prompt\n{system_prompt}\n\n\
         ## User Input\n{test_input}{expected}\n\n\
         ## Model Response\n{model_response}\n\n\
         ## Criteria to Score\n{criteria_list}"
    )
}

pub async fn judge_response(
    client: &OpenRouterClient,
    judge_model: &str,
    system_prompt: &str,
    test_input: &str,
    expected_output: Option<&str>,
    model_response: &str,
    criteria: &[String],
) -> Result<JudgeScores, JudgeError> {
    let user_prompt = build_judge_user_prompt(
        system_prompt, test_input, expected_output, model_response, criteria
    );

    let resp = client.chat_completion(judge_model, JUDGE_SYSTEM_PROMPT, &user_prompt).await?;

    parse_judge_response(&resp.content, criteria)
}

fn parse_judge_response(content: &str, criteria: &[String]) -> Result<JudgeScores, JudgeError> {
    // 1. Try direct JSON parse
    // 2. If fails, try extracting JSON from markdown code block
    // 3. If fails, try regex for {"scores": ...} pattern
    // 4. Validate all criteria present and scores are 1-10
    // 5. If any score missing, default to 5 (neutral)
    // 6. If completely unparseable, return JudgeError::ParseFailed
}
```

**Judge fan-out strategy:** Judge calls start as soon as each model result arrives (not after all models complete). This pipelines the work:

```rust
pub async fn fan_out_judge_calls(
    client: &OpenRouterClient,
    model_results: &[ModelResultData],
    config: &BenchmarkRequest,
    tx: &Sender<SseEvent>,
) -> Vec<JudgeResultData> {
    let semaphore = Arc::new(Semaphore::new(5)); // Lower concurrency for free-tier rate limits
    let counter = Arc::new(AtomicU32::new(0));
    let total = model_results.len() * config.judge_models.len();

    // For each model result × each judge model → spawn judge task
    // Same pattern as fan_out_model_calls but with lower semaphore

    // On 429 (rate limited): wait 2s, retry once. If still 429, skip with error event.
}
```

**Semaphore at 5 for judges:** Free-tier models have low rate limits. Serialize more aggressively.

### routing.rs — Heuristic Routing Recommender

```rust
pub fn recommend_routing(
    results: &[ModelResultData],
    judge_results: &[JudgeResultData],
    pricing: &HashMap<String, ModelPricing>,
    test_cases: &[TestCase],
) -> RoutingPolicy {
    // Step 1: Rank models by composite score
    let rankings = compute_rankings(results, judge_results, pricing);

    // Step 2: Identify frontier model (highest quality) and value model (best quality/cost)
    let frontier = &rankings[0]; // Best composite
    let value = rankings.iter()
        .filter(|r| r.avg_quality >= frontier.avg_quality * 0.85) // Within 15% quality
        .min_by(|a, b| a.cost_per_1k_tokens.partial_cmp(&b.cost_per_1k_tokens).unwrap())
        .unwrap_or(frontier);

    // Step 3: If frontier == value, no routing benefit
    if frontier.model_id == value.model_id {
        return RoutingPolicy::single_model(frontier);
    }

    // Step 4: Classify test cases by difficulty
    let difficulty_signals = classify_difficulty(test_cases);
    let hard_pct = estimate_hard_traffic_pct(&difficulty_signals, test_cases);

    // Step 5: Calculate savings
    let frontier_cost = frontier.cost_per_1k_tokens;
    let value_cost = value.cost_per_1k_tokens;
    let blended_cost = (hard_pct * frontier_cost) + ((1.0 - hard_pct) * value_cost);
    let savings_pct = ((frontier_cost - blended_cost) / frontier_cost * 100.0).round();

    RoutingPolicy {
        primary_model: value.model_id.clone(),
        primary_traffic_pct: ((1.0 - hard_pct) * 100.0).round() as u32,
        frontier_model: frontier.model_id.clone(),
        frontier_traffic_pct: (hard_pct * 100.0).round() as u32,
        estimated_savings_pct: savings_pct as u32,
        difficulty_threshold: difficulty_signals,
        reasoning: format!(
            "{} scored within 15% of {} on simple prompts at {:.0}x lower cost. \
             Route hard prompts ({}) to {} for quality, everything else to {} for savings.",
            value.model_id, frontier.model_id,
            frontier_cost / value_cost,
            difficulty_signals.iter().map(|s| s.as_str()).collect::<Vec<_>>().join(", "),
            frontier.model_id, value.model_id
        ),
    }
}
```

### Difficulty Classification Algorithm

```rust
pub fn classify_difficulty(test_cases: &[TestCase]) -> Vec<DifficultySignal> {
    let mut signals = Vec::new();

    for tc in test_cases {
        let text = format!("{} {}", tc.input, tc.expected_output.as_deref().unwrap_or(""));
        let lower = text.to_lowercase();

        // Token count heuristic (rough: 1 token ≈ 4 chars)
        if text.len() > 8000 { // ~2000 tokens
            signals.push(DifficultySignal::TokenCount);
        }

        // Code markers
        if lower.contains("```") || lower.contains("def ") || lower.contains("function ")
            || lower.contains("class ") || lower.contains("impl ") || lower.contains("fn ")
        {
            signals.push(DifficultySignal::CodeMarkers);
        }

        // Math markers
        if lower.contains("calculate") || lower.contains("prove") || lower.contains("equation")
            || lower.contains("∑") || lower.contains("∫") || text.contains("\\frac")
        {
            signals.push(DifficultySignal::MathMarkers);
        }

        // Reasoning markers
        if lower.contains("step by step") || lower.contains("analyze") || lower.contains("compare")
            || lower.contains("evaluate") || lower.contains("explain why")
        {
            signals.push(DifficultySignal::ReasoningMarkers);
        }

        // Multi-constraint (count sentences ending with imperative verbs or containing "must", "should")
        let constraint_count = lower.matches("must ").count()
            + lower.matches("should ").count()
            + lower.matches("ensure ").count()
            + lower.matches("make sure").count();
        if constraint_count > 3 {
            signals.push(DifficultySignal::MultiConstraint);
        }
    }

    signals.sort();
    signals.dedup();
    signals
}

fn estimate_hard_traffic_pct(signals: &[DifficultySignal], test_cases: &[TestCase]) -> f64 {
    // Count how many test cases trigger at least one difficulty signal
    let hard_count = test_cases.iter()
        .filter(|tc| has_any_signal(tc, signals))
        .count();

    hard_count as f64 / test_cases.len() as f64
}
```

**Complexity:** O(T × S) where T = test cases, S = signal patterns. Both small → negligible.

### scoring.rs — Score Aggregation

```rust
pub fn compute_rankings(
    results: &[ModelResultData],
    judge_results: &[JudgeResultData],
    pricing: &HashMap<String, ModelPricing>,
) -> Vec<ModelRanking> {
    let model_ids: HashSet<&str> = results.iter().map(|r| r.model_id.as_str()).collect();

    let mut rankings: Vec<ModelRanking> = model_ids.iter().map(|model_id| {
        let model_results: Vec<_> = results.iter().filter(|r| r.model_id == *model_id).collect();
        let model_judges: Vec<_> = judge_results.iter().filter(|j| j.model_id == *model_id).collect();

        // Average quality across all judges and test cases
        let avg_quality = if model_judges.is_empty() {
            5.0 // Default neutral if no judge results
        } else {
            let total: f64 = model_judges.iter()
                .flat_map(|j| j.scores.values())
                .sum();
            let count = model_judges.iter()
                .flat_map(|j| j.scores.values())
                .count();
            total / count as f64
        };

        let avg_latency_ms = model_results.iter().map(|r| r.latency_ms as f64).sum::<f64>()
            / model_results.len() as f64;

        let total_cost_usd: f64 = model_results.iter().map(|r| r.cost_usd).sum();

        let total_tokens: u64 = model_results.iter().map(|r| r.tokens_in + r.tokens_out).sum();
        let cost_per_1k_tokens = if total_tokens > 0 {
            total_cost_usd / (total_tokens as f64 / 1000.0)
        } else {
            0.0
        };

        // Composite: 60% quality + 25% cost_efficiency + 15% speed
        // Normalize each to 0-1 range before weighting (done in second pass)
        ModelRanking {
            model_id: model_id.to_string(),
            avg_quality,
            avg_latency_ms,
            total_cost_usd,
            cost_per_1k_tokens,
            composite_score: 0.0, // Computed in normalization pass
        }
    }).collect();

    // Normalization pass: min-max scale each dimension to [0, 1]
    normalize_and_score(&mut rankings);

    // Sort by composite_score descending
    rankings.sort_by(|a, b| b.composite_score.partial_cmp(&a.composite_score).unwrap());
    rankings
}

fn normalize_and_score(rankings: &mut [ModelRanking]) {
    if rankings.is_empty() { return; }

    let max_quality = rankings.iter().map(|r| r.avg_quality).fold(f64::MIN, f64::max);
    let min_quality = rankings.iter().map(|r| r.avg_quality).fold(f64::MAX, f64::min);
    let max_latency = rankings.iter().map(|r| r.avg_latency_ms).fold(f64::MIN, f64::max);
    let min_latency = rankings.iter().map(|r| r.avg_latency_ms).fold(f64::MAX, f64::min);
    let max_cost = rankings.iter().map(|r| r.cost_per_1k_tokens).fold(f64::MIN, f64::max);
    let min_cost = rankings.iter().map(|r| r.cost_per_1k_tokens).fold(f64::MAX, f64::min);

    for r in rankings.iter_mut() {
        let norm_quality = safe_normalize(r.avg_quality, min_quality, max_quality);
        // Latency and cost: lower is better, so invert
        let norm_speed = 1.0 - safe_normalize(r.avg_latency_ms, min_latency, max_latency);
        let norm_cost_eff = 1.0 - safe_normalize(r.cost_per_1k_tokens, min_cost, max_cost);

        r.composite_score = (0.60 * norm_quality) + (0.25 * norm_cost_eff) + (0.15 * norm_speed);
    }
}

fn safe_normalize(val: f64, min: f64, max: f64) -> f64 {
    if (max - min).abs() < f64::EPSILON { 0.5 } else { (val - min) / (max - min) }
}
```

### sse.rs — SSE Event Formatting

```rust
use tokio::sync::mpsc::Receiver;
use bytes::Bytes;
use futures::Stream;

pub enum SseEvent {
    BenchmarkStarted { total_tasks: u32, total_judge_tasks: u32, estimated_cost_usd: f64 },
    ModelResult(ModelResultData),
    JudgeResult(JudgeResultData),
    Recommendation(RecommendationData),
    Error(BenchmarkErrorData),
    Done,
}

impl SseEvent {
    pub fn to_sse_bytes(&self) -> Bytes {
        let (event_name, data) = match self {
            SseEvent::BenchmarkStarted { .. } => ("benchmark_started", serde_json::to_string(self).unwrap()),
            SseEvent::ModelResult(r) => ("model_result", serde_json::to_string(r).unwrap()),
            SseEvent::JudgeResult(j) => ("judge_result", serde_json::to_string(j).unwrap()),
            SseEvent::Recommendation(r) => ("recommendation", serde_json::to_string(r).unwrap()),
            SseEvent::Error(e) => ("error", serde_json::to_string(e).unwrap()),
            SseEvent::Done => ("done", "{}".to_string()),
        };

        Bytes::from(format!("event: {event_name}\ndata: {data}\n\n"))
    }
}

pub struct SseStream {
    rx: Receiver<SseEvent>,
}

impl Stream for SseStream {
    type Item = Result<Bytes, std::io::Error>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        match self.rx.poll_recv(cx) {
            Poll::Ready(Some(event)) => Poll::Ready(Some(Ok(event.to_sse_bytes()))),
            Poll::Ready(None) => Poll::Ready(None),
            Poll::Pending => Poll::Pending,
        }
    }
}
```

### validation.rs — Input Validation

```rust
pub fn validate_benchmark_request(req: &BenchmarkRequest) -> Result<(), ValidationError> {
    if req.system_prompt.is_empty() || req.system_prompt.len() > 10_000 {
        return Err(ValidationError::field("system_prompt", "must be 1-10,000 chars"));
    }
    if req.test_cases.is_empty() || req.test_cases.len() > 50 {
        return Err(ValidationError::field("test_cases", "must have 1-50 items"));
    }
    for (i, tc) in req.test_cases.iter().enumerate() {
        if tc.input.is_empty() || tc.input.len() > 10_000 {
            return Err(ValidationError::field(&format!("test_cases[{i}].input"), "must be 1-10,000 chars"));
        }
        if let Some(ref expected) = tc.expected_output {
            if expected.len() > 10_000 {
                return Err(ValidationError::field(&format!("test_cases[{i}].expected_output"), "max 10,000 chars"));
            }
        }
    }
    if req.models.len() < 3 || req.models.len() > 10 {
        return Err(ValidationError::field("models", "must have 3-10 items"));
    }
    for model in &req.models {
        if !model.contains('/') {
            return Err(ValidationError::field("models", &format!("invalid model ID format: {model}")));
        }
    }
    if let Some(ref judges) = req.judge_models {
        if judges.is_empty() || judges.len() > 3 {
            return Err(ValidationError::field("judge_models", "must have 1-3 items"));
        }
    }
    if let Some(ref criteria) = req.rubric_criteria {
        if criteria.is_empty() || criteria.len() > 5 {
            return Err(ValidationError::field("rubric_criteria", "must have 1-5 items"));
        }
    }
    Ok(())
}
```

---

## 4. Algorithm Details

### Cost Calculation

```
cost_usd = (tokens_in × pricing.prompt_per_token) + (tokens_out × pricing.completion_per_token)
```

Where `prompt_per_token` and `completion_per_token` come from OpenRouter's model pricing (string → f64).

**Edge cases:**
- Free models: pricing = "0" → cost = $0.00
- Missing usage data in response: use 0 tokens, cost = $0.00, log warning
- Null pricing: treat as $0.00 (likely free model)

### Pre-Run Cost Estimation

Before starting the benchmark, estimate total cost:

```
estimated_tokens_per_case = avg(test_case_input_chars / 4) + estimated_output_tokens
estimated_output_tokens = 500  // Conservative default

for each model:
    model_cost = test_cases.len() × (
        (system_prompt_chars/4 + estimated_tokens_per_case) × pricing.prompt
        + estimated_output_tokens × pricing.completion
    )

total_estimated = sum(model_costs) + 0  // Judge costs are $0 (free tier)
```

### Composite Score Weights

```
composite = 0.60 × normalized_quality + 0.25 × normalized_cost_efficiency + 0.15 × normalized_speed
```

**Rationale:**
- Quality is king (60%) — wrong answers at low cost aren't useful
- Cost efficiency matters more than raw speed for B2B (25%)
- Speed is tiebreaker (15%) — most OpenRouter models respond in 1-10s

---

## 5. Error Handling & Resilience

| Failure mode | Strategy |
|-------------|----------|
| Single model call fails (timeout, 500) | Log error, stream `error` event, continue with remaining models. Don't abort the whole benchmark. |
| Single model returns 429 (rate limited) | Wait 2s, retry once. If still 429, stream error event, skip. |
| Judge model returns unparseable response | Try 3 parsing strategies (direct, code block extraction, regex). If all fail, assign default score of 5 and stream error event noting parse failure. |
| Judge model returns 429 | Wait 3s, retry once. Free-tier rate limits are stricter. |
| All models fail | Stream error event + done event. Frontend shows "all models failed" state. |
| OpenRouter API completely down | All model calls fail → all-fail case above. |
| Lambda approaching timeout (4.5 min) | Check elapsed time before starting each new judge batch. If >4.5 min, skip remaining judges, compute rankings with available data, stream recommendation + done. |
| SSE channel full (100 buffer) | `tx.send().await` blocks until consumer catches up. If consumer disconnects, sends will error → graceful shutdown. |

**No circuit breaker:** POC scope. Each benchmark is a one-shot operation with no shared state between invocations.

**No DLQ:** No async processing. All errors surface immediately via SSE.

---

## 6. Test Plan

### Unit Tests

| Module | Function | Tests |
|--------|----------|-------|
| `validation` | `validate_benchmark_request` | Valid request passes; empty system_prompt fails; 0 models fails; 11 models fails; invalid model ID format fails; 51 test cases fails; test_case.input > 10K fails |
| `judge` | `build_judge_user_prompt` | Includes system prompt, input, response; includes expected output when present; omits expected output when None; includes custom criteria |
| `judge` | `parse_judge_response` | Parses clean JSON; parses JSON in markdown code block; extracts from noisy text; handles missing criteria (defaults to 5); handles scores outside 1-10 (clamps); returns error on garbage |
| `routing` | `classify_difficulty` | Detects code markers; detects math markers; detects reasoning markers; detects token count; detects multi-constraint; returns empty for simple text; deduplicates signals |
| `routing` | `estimate_hard_traffic_pct` | All hard → 1.0; none hard → 0.0; mixed → correct ratio |
| `routing` | `recommend_routing` | Single best model → single_model policy; frontier + value → split policy; savings calculation correct |
| `scoring` | `compute_rankings` | Correct avg_quality; correct avg_latency; correct cost aggregation; composite weights correct |
| `scoring` | `safe_normalize` | Normal range; all same value → 0.5; single item → 0.5 |
| `sse` | `SseEvent::to_sse_bytes` | Correct SSE format with event: and data: lines; valid JSON in data field; double newline terminators |
| `openrouter` | cost calculation | Zero-cost for free models; correct math for paid; handles null pricing |

### Integration Tests

| Test | Description |
|------|-------------|
| `benchmark_e2e_mock` | Mock OpenRouter responses for 3 models × 2 test cases. Verify SSE stream contains: benchmark_started, 6 model_results, judge_results, recommendation, done — in correct order. |
| `benchmark_partial_failure` | Mock 1 of 3 models to return 500. Verify: error event for failed model, remaining 2 models scored, recommendation based on 2 models. |
| `benchmark_judge_parse_failure` | Mock judge returning non-JSON. Verify: default scores assigned, error event streamed, recommendation still generated. |
| `benchmark_validation_rejection` | Send invalid request (0 models). Verify: 400 response with validation error, no SSE stream. |
| `benchmark_rate_limit_retry` | Mock first judge call returning 429, second succeeding. Verify: retry happens after delay, score arrives. |
| `cost_estimation` | Known model pricing + known test cases → verify estimated_cost_usd in benchmark_started event. |

### Contract Tests

| Test | Description |
|------|-------------|
| `sse_event_schema` | Each SSE event type deserializes to matching TypeScript interface (generate JSON samples, validate against frontend types). |
| `request_validation_matches_frontend` | Frontend validation rules match backend validation (max lengths, counts). |

### Load Test Targets

Not applicable for POC (single-user, capped at 10 concurrent Lambda executions).

---

## Adversarial Review

Reviewed: 2026-06-24

### Challenge 1: Race Condition in Composite Score Calculation
> Judge results arrive asynchronously. If scoring/normalization runs before all judge results complete, min-max bounds are wrong and models are mis-ranked.

**Disposition: Accepted**

Valid concern. Fix: `run_benchmark` must explicitly `join_all(judge_handles).await` before calling `compute_rankings()`. The pipeline becomes:

```
Phase 1: fan_out_model_calls() → collect all model results
Phase 2: fan_out_judge_calls() → join_all(judge_handles).await → collect all judge results
Phase 3: compute_rankings() → only runs after Phase 2 completes
Phase 4: recommend_routing() → uses complete rankings
```

Updated `fanout.rs` design: both `fan_out_model_calls` and `fan_out_judge_calls` return only after all handles are joined. The streaming SSE events fire as individual results arrive (via the `tx` channel), but the final recommendation waits for completeness.

### Challenge 2: Judge Parse Fallback Assigns Neutral Scores Silently
> Defaulting to score 5 on parse failure is indistinguishable from a neutral judgment. Hides judge misbehavior.

**Disposition: Partially Accepted**

**Accepted:** Add `is_fallback: bool` to `JudgeScores`. Include in SSE `judge_result` event so frontend can mark imputed scores visually. Track fallback count per model.

**Rejected:** "Cap fallback to max 1 then abort recommendation." Too aggressive for POC — free-tier models will frequently return unparseable responses. Aborting recommendation removes the core value prop. Instead:

- Track `fallback_count` in aggregation
- Include fallback rate in `ModelRanking` confidence (see Challenge 5)
- Frontend shows warning icon on imputed scores with tooltip

Updated `judge.rs`: `parse_judge_response` returns `JudgeScores { scores, reasoning, is_fallback }`.

### Challenge 3: Difficulty Classification Misses Hard Cases
> Keyword-based classification misses token-heavy, multi-step, or action-verb-dense prompts.

**Disposition: Partially Accepted**

**Accepted:** Lower the char-length threshold. Current LLD says 8000 chars (~2000 tokens). Reduce to 4000 chars (~1000 tokens) as the challenger suggests. This catches more genuinely complex prompts without over-classifying.

**Rejected:** Action verb density analysis. Over-engineered for a heuristic classifier in a POC. The heuristic is explicitly labeled as "directional" — the real fix (v2) is a trained classifier model. Adding NLP parsing to heuristics creates false confidence in a fundamentally limited approach.

Updated `routing.rs`: threshold changed from `text.len() > 8000` to `text.len() > 4000`.

### Challenge 4: SSE Channel Overflow Causes Resource Leaks
> If client disconnects, `tx.send()` errors are unhandled. Lambda keeps running, burning compute.

**Disposition: Accepted**

Fix: Add `tokio_util::sync::CancellationToken` to coordinate graceful shutdown.

```rust
let cancel = CancellationToken::new();

// In each spawned task:
tokio::select! {
    result = client.chat_completion(...) => { /* handle result */ }
    _ = cancel.cancelled() => { return; }
}

// In send logic:
if tx.send(event).await.is_err() {
    cancel.cancel(); // Client disconnected, abort all tasks
    return;
}
```

Updated dependencies: add `tokio-util` crate. Updated `fanout.rs` to accept `CancellationToken` and check on each send. Updated `main.rs` to create token and pass to `run_benchmark`.

### Challenge 5: No Judge Failure Detection
> Models with zero judge results still rank with default 5.0. No confidence signal in recommendation.

**Disposition: Accepted**

Add `confidence: f64` to `ModelRanking`:

```rust
let expected_judge_count = judge_models.len() * test_cases.len();
let actual_judge_count = model_judges.iter().filter(|j| !j.is_fallback).count();
let confidence = actual_judge_count as f64 / expected_judge_count as f64;
```

Add `incomplete_models: Vec<String>` to `RoutingPolicy` — lists models with confidence < 0.5.

Add to recommendation reasoning: "⚠️ Models X, Y have incomplete judge data (N% confidence) — consider rerunning."

Updated `scoring.rs` and `types.rs` with confidence field. Updated `routing.rs` to include incomplete_models warning.

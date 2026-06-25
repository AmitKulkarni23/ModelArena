# ModelArena — High-Level Design

**Status:** DRAFT
**Date:** 2026-06-24
**Scope:** POC (proof-of-concept)

---

## 1. System Overview

ModelArena is a B2B benchmarking tool that answers "which LLM should we actually use?" for teams shipping AI features. A user pastes a system prompt and a set of test cases, selects 3–10 models from OpenRouter's catalog, and launches a benchmark. The system fans out requests to each model via OpenRouter's unified API, streams results back in real time, then runs an ensemble of free-tier judge models to score each response on a 1–10 rubric (relevance, accuracy, completeness). A results dashboard shows quality × latency × cost across all models and test cases, and a heuristic engine recommends an optimal model plus a routing policy (e.g., "use Gemma for 80% of traffic, Claude for the hard 20% → save 73%").

**POC constraints:** Single hardcoded OpenRouter API key, no user auth, session-only results (no persistence), synchronous streaming execution.

---

## 2. Core User Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. CREATE BENCHMARK                                              │
│    • Paste system prompt                                         │
│    • Add 1–N test cases (input + optional expected output)       │
│    • Optional: rubric criteria overrides                         │
├──────────────────────────────────────────────────────────────────┤
│ 2. SELECT MODELS                                                 │
│    • Browse/search/filter OpenRouter catalog                     │
│    • Pick 3–10 models (see price, context length, modality)      │
│    • System shows estimated cost before run                      │
├──────────────────────────────────────────────────────────────────┤
│ 3. RUN BENCHMARK                                                 │
│    • System fans out: M models × N test cases                    │
│    • Results stream via SSE (progress bar, partial results)      │
│    • Each response scored by 2–3 free-tier judge models          │
├──────────────────────────────────────────────────────────────────┤
│ 4. VIEW RESULTS                                                  │
│    • Matrix: model × test case (quality, latency, cost)          │
│    • Aggregate rankings (weighted score)                         │
│    • Routing policy recommendation                               │
│    • Expandable: see full responses, judge reasoning             │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Service Decomposition

### 3.1 Frontend SPA

| Attribute       | Value                                        |
|-----------------|----------------------------------------------|
| **Responsibility** | All UI: benchmark creation, model selection, results dashboard |
| **Tech**        | React 19 + TypeScript + MUI 7, Bun runtime, Vite bundler |
| **Hosting**     | S3 + CloudFront (same pattern as Radar)      |
| **Auth**        | None (POC)                                   |

### 3.2 Models Lambda

| Attribute       | Value                                        |
|-----------------|----------------------------------------------|
| **Responsibility** | Proxy OpenRouter's `/api/v1/models` endpoint. Fetch, filter, and cache model catalog with pricing. |
| **Tech**        | Rust (Lambda, cargo-lambda)                  |
| **AWS services**| Lambda Function URL                          |
| **Why Lambda?** | Simple proxy, infrequent calls, cold start acceptable for catalog browsing |

Caches the OpenRouter model list in-memory for the Lambda instance lifetime (~5–15 min warm). Returns filtered/searchable model metadata to frontend.

### 3.3 Benchmark Orchestrator Lambda

| Attribute       | Value                                        |
|-----------------|----------------------------------------------|
| **Responsibility** | Receive benchmark request, fan out model calls, aggregate results, stream back via SSE |
| **Tech**        | Rust (Lambda, cargo-lambda), Lambda Function URL with response streaming |
| **AWS services**| Lambda Function URL (with streaming response) |
| **Why single Lambda?** | POC scope — M models × N test cases is manageable with async Tokio tasks within one Lambda. Avoids Step Functions complexity. Max concurrency: 10 models × 20 test cases = 200 concurrent HTTP calls, well within Lambda limits. |

**Internal flow:**
```
Request in (models[], test_cases[], system_prompt, judge_config)
    │
    ├─ For each (model, test_case) pair:
    │     ├─ POST openrouter.ai/api/v1/chat/completions
    │     ├─ Measure: TTFB, total_time, token counts
    │     ├─ Calculate cost from pricing data
    │     └─ Stream partial result to client via SSE
    │
    ├─ For each completed response:
    │     ├─ Fan out to 2–3 judge models (also via OpenRouter)
    │     ├─ Parse judge scores (1–10 per criterion)
    │     └─ Stream judge results to client
    │
    └─ After all complete:
          ├─ Compute aggregate scores
          ├─ Run routing heuristic
          └─ Stream final recommendation
```

**Lambda streaming:** Uses Lambda Function URL with `RESPONSE_STREAM` invoke mode. The Rust handler writes SSE events as results arrive. No API Gateway needed (API GW doesn't support streaming responses).

### 3.4 Judge Scoring (within Orchestrator)

Not a separate service — runs as async tasks within the Orchestrator Lambda.

| Attribute       | Value                                        |
|-----------------|----------------------------------------------|
| **Responsibility** | Score each model response using 2–3 free-tier judge models |
| **Judge models**| Use OpenRouter `:free` variant models (e.g., `meta-llama/llama-4-maverick:free`, `google/gemma-3-27b-it:free`, or `openrouter/free` auto-router) |
| **Scoring rubric** | 1–10 scale on: Relevance, Accuracy, Completeness. Structured JSON output requested from judges. |
| **Cost**        | $0 (free tier models). Rate-limited, so judges run with backoff/retry. |

**Judge prompt template:**
```
You are an expert evaluator. Score this LLM response on a 1-10 scale.

System prompt: {system_prompt}
User input: {test_case_input}
Expected output (if any): {expected_output}
Model response: {response}

Score each criterion:
- Relevance (1-10): How well does the response address the input?
- Accuracy (1-10): How factually/logically correct is the response?
- Completeness (1-10): Does the response fully address all aspects?

Respond in JSON: {"relevance": N, "accuracy": N, "completeness": N, "reasoning": "..."}
```

**UI callout:** Since judges are free-tier models, display a playful disclaimer on the results page:
> "⚖️ Judged by our free-tier panel — they work for exposure, not tokens. Take scores directionally, not as gospel."

### 3.5 Routing Recommender (within Orchestrator)

Not a separate service — runs as final aggregation step in Orchestrator.

| Attribute       | Value                                        |
|-----------------|----------------------------------------------|
| **Responsibility** | Analyze benchmark results, recommend optimal model + routing policy |
| **Approach**    | Heuristic rules based on prompt characteristics |

**Heuristic classification:**

| Signal              | Hard prompt indicator                      |
|---------------------|-------------------------------------------|
| Token count         | Input > 2000 tokens                       |
| Code markers        | Contains ` ``` `, `def `, `function `, `class ` |
| Math markers        | Contains `∑`, `∫`, LaTeX, `calculate`, `prove` |
| Reasoning markers   | `step by step`, `analyze`, `compare`, `evaluate` |
| Multi-constraint    | > 3 distinct instructions in prompt        |

**Routing policy output:**
```json
{
  "primary_model": "deepseek/deepseek-v4-pro",
  "primary_traffic_pct": 80,
  "frontier_model": "anthropic/claude-opus-4.8",
  "frontier_traffic_pct": 20,
  "estimated_cost_reduction_pct": 73,
  "difficulty_signals": ["token_count", "code_markers"],
  "reasoning": "DeepSeek V4 Pro scored within 5% of Claude Opus on simple prompts at 1/10th the cost..."
}
```

---

## 4. Data Architecture

### 4.1 No Persistent Data Store (POC)

**Decision:** No DynamoDB, no Aurora, no persistence.

**Justification:** POC scope — results live in browser state (React state / context). User refreshes = results gone. This eliminates all data modeling, cleanup, and storage costs.

### 4.2 Data Flow

```
Frontend (React state)
    │
    ├─ Benchmark config (prompt, test cases, model selections)
    │   → sent as POST body to Orchestrator Lambda
    │
    ├─ Model catalog (cached from Models Lambda)
    │   → fetched on page load, stored in React state
    │
    └─ Benchmark results (streamed via SSE)
        → parsed and accumulated in React state
        → includes: responses, scores, latencies, costs, recommendation
```

### 4.3 Data Structures (In-Memory / Wire Format)

**BenchmarkRequest:**
```
{
  system_prompt: string,
  test_cases: [{ input: string, expected_output?: string }],
  models: [string],           // OpenRouter model IDs
  judge_models: [string],     // Free-tier judge model IDs
  rubric_criteria?: [string]  // Override default criteria
}
```

**SSE Event Stream:**
```
event: model_result
data: { model_id, test_case_idx, response, latency_ms, ttfb_ms, tokens_in, tokens_out, cost_usd }

event: judge_result
data: { model_id, test_case_idx, judge_model_id, scores: { relevance, accuracy, completeness }, reasoning }

event: recommendation
data: { primary_model, primary_pct, frontier_model, frontier_pct, savings_pct, reasoning }

event: error
data: { model_id?, test_case_idx?, error: string }

event: done
data: {}
```

---

## 5. API Surface

### 5.1 Models Lambda

| Method | Path       | Purpose                                      | Sync |
|--------|-----------|-----------------------------------------------|------|
| GET    | `/models` | List OpenRouter models with pricing & metadata | Yes  |
| GET    | `/models?search=llama&max_price=0.001` | Filtered model search | Yes |

### 5.2 Orchestrator Lambda

| Method | Path          | Purpose                                     | Sync |
|--------|--------------|----------------------------------------------|------|
| POST   | `/benchmark`  | Start benchmark run, returns SSE stream     | SSE  |

Single endpoint. All complexity in the streaming response.

---

## 6. Infrastructure

### 6.1 Architecture Diagram

```
                         ┌─────────────────────┐
                         │    User Browser      │
                         │  React + MUI SPA     │
                         └─────────┬────────────┘
                                   │ HTTPS
                         ┌─────────┴────────────┐
                         │   AWS CloudFront     │
                         │   (us-east-1)        │
                         │                      │
                         │  /* → S3 (SPA)       │
                         │  /api/models → λ     │
                         │  /api/benchmark → λ  │
                         └──┬──────┬────────┬───┘
                            │      │        │
                    ┌───────┘      │        └────────┐
                    ▼              ▼                  ▼
              ┌──────────┐  ┌───────────────┐  ┌──────────┐
              │ S3 Bucket│  │ Models Lambda │  │Orchestr. │
              │ (SPA)    │  │ (Rust)        │  │ Lambda   │
              │          │  │               │  │ (Rust)   │
              │ index.html│ │ GET /models   │  │ POST     │
              │ assets/* │  │ proxy+cache   │  │ /benchmark│
              └──────────┘  │ OpenRouter    │  │ SSE stream│
                            └───────────────┘  │          │
                                               │  ┌──────┐│
                                               │  │Tokio ││
                                               │  │tasks ││
                                               │  │      ││
                                               │  │ M×N  ││
                                               │  │model ││
                                               │  │calls ││
                                               │  │      ││
                                               │  │ J×M×N││
                                               │  │judge ││
                                               │  │calls ││
                                               │  └──────┘│
                                               └──────────┘
                                                    │
                                                    ▼
                                          ┌──────────────────┐
                                          │  OpenRouter API  │
                                          │  /v1/chat/       │
                                          │  completions     │
                                          │  /v1/models      │
                                          └──────────────────┘
```

### 6.2 CloudFront Behaviors

| Path pattern      | Origin                    | Cache          |
|-------------------|---------------------------|----------------|
| `/api/models*`    | Models Lambda Function URL| 5 min TTL      |
| `/api/benchmark*` | Orchestrator Lambda URL   | No cache       |
| `/*` (default)    | S3 bucket (SPA)          | 24h, invalidate on deploy |

### 6.3 Lambda Configuration

| Lambda        | Memory | Timeout | Invoke mode      | Concurrency |
|---------------|--------|---------|------------------|-------------|
| Models        | 256 MB | 30s     | BUFFERED         | 10          |
| Orchestrator  | 1024 MB| 300s (5 min) | RESPONSE_STREAM | 10     |

**Orchestrator needs 5 min timeout:** 10 models × 20 test cases, some models may take 10-30s each. Plus judge calls after. Sequential bottleneck is the slowest model.

**Orchestrator needs 1 GB memory:** Holds all responses in memory for judge scoring and final aggregation. 200 responses × ~4KB each = ~800KB data, but Tokio runtime + HTTP client pool need headroom.

### 6.4 Security

| Concern                  | Solution                                              |
|--------------------------|-------------------------------------------------------|
| OpenRouter API key       | Lambda env var (encrypted at rest by default)         |
| Origin verification      | CloudFront → Lambda via `x-origin-verify` header (Radar pattern) |
| CORS                     | Lambda adds CORS headers, CloudFront forwards `Origin` header |
| No user auth             | POC — acceptable risk, rate limited by Lambda concurrency |
| Input validation         | Rust backend validates: max 10 models, max 50 test cases, max 10K chars per test case |

### 6.5 Deployment

- **CDK TypeScript** in `infra/` (same pattern as Radar)
- **Single stack:** `ModelArenaStack` — S3, CloudFront, 2 Lambdas
- **Build:** `cargo lambda build --release` for each Lambda
- **Frontend:** `bun run build` → S3 sync → CloudFront invalidation
- **Makefile** orchestrates build + deploy (Radar pattern)
- **No CI/CD for POC** — manual `make deploy`

---

## 7. NFR Design Decisions

### 7.1 Performance

| Target                    | Design choice                                |
|---------------------------|----------------------------------------------|
| Model catalog < 1s        | Lambda caches OpenRouter model list in-memory. CloudFront caches 5 min. |
| Benchmark start < 2s      | Lambda Function URL (no API GW cold start). Rust cold start ~100ms. |
| Results stream in real-time| SSE from Lambda streaming response. User sees first result within seconds. |
| Fan-out throughput        | Tokio async tasks. All M×N model calls launch concurrently. Bounded by OpenRouter rate limits, not Lambda. |

### 7.2 Availability

| Target    | Design choice                                          |
|-----------|--------------------------------------------------------|
| POC-grade | No multi-AZ, no health checks, no auto-failover. Single Lambda per function. CloudFront provides edge availability for SPA. |

### 7.3 Scalability

| Target    | Design choice                                          |
|-----------|--------------------------------------------------------|
| POC-grade | Lambda auto-scales to 10 concurrent executions. Sufficient for single-user POC. |

### 7.4 Observability

| Signal      | Tool                                              |
|-------------|---------------------------------------------------|
| Lambda logs | CloudWatch Logs (structured JSON via `tracing` crate) |
| Latency     | Measured in-Lambda, included in SSE events        |
| Cost        | Calculated from OpenRouter token counts × pricing  |
| Errors      | Streamed as SSE `error` events to frontend         |

### 7.5 Cost Estimate (Infrastructure Only)

| Service     | Estimated monthly cost                            |
|-------------|---------------------------------------------------|
| Lambda      | ~$0.50 (minimal invocations for POC)              |
| CloudFront  | ~$1.00 (low traffic)                              |
| S3          | ~$0.10                                            |
| **Total**   | **~$2/month** (OpenRouter API costs are separate)  |

---

## 8. Key Design Decisions & Tradeoffs

### 8.1 Single Orchestrator Lambda vs. Step Functions

**Chose:** Single Lambda with Tokio async tasks.
**Why:** POC scope. Step Functions adds coordination complexity (state machine definition, error handling per step, IAM roles). For ≤200 concurrent HTTP calls, a single Rust Lambda with Tokio handles it cleanly. Step Functions becomes necessary when: (a) runs exceed 15 min, (b) individual model calls need independent retry/DLQ, (c) state needs checkpointing.

### 8.2 Lambda Function URLs vs. API Gateway

**Chose:** Lambda Function URLs behind CloudFront.
**Why:** API Gateway doesn't support SSE streaming responses. Function URLs with `RESPONSE_STREAM` invoke mode do. CloudFront provides caching, HTTPS, and custom domain support that API GW would otherwise provide.

### 8.3 Free-Tier Judges vs. Paid Frontier Judges

**Chose:** Free-tier judges with playful disclaimer.
**Why:** POC cost optimization. Free models (Llama, Gemma, etc.) are good enough for directional quality signals. The 1–10 scores should be interpreted as relative rankings within a run, not absolute quality measures. A paid-tier judge upgrade is a natural v2 monetization lever.

### 8.4 No Persistence vs. DynamoDB

**Chose:** No persistence.
**Why:** POC — eliminates data modeling, TTL management, and storage costs. Session-only results are acceptable for demos and evaluation. v2 adds DynamoDB for saved benchmarks, comparison history, and team sharing.

### 8.5 Bun vs. Node for Frontend Tooling

**Chose:** Bun.
**Why:** Faster installs, faster dev server, TypeScript-native. Vite still used as bundler (Bun's bundler isn't mature enough for production React builds). Bun is the runtime for `bun run dev`, `bun install`, etc. — Vite handles the actual bundling.

---

## 9. Open Questions for LLD

1. **Judge model selection:** Need to test which `:free` models reliably return structured JSON scores. Fallback strategy if a judge returns unparseable output.
2. **OpenRouter rate limits on free models:** Need to measure actual rate limits and design backoff strategy. May need to serialize judge calls rather than parallelize.
3. **SSE reconnection:** If browser loses connection mid-benchmark, how to resume? (POC: don't — user restarts.)
4. **Cost estimation pre-run:** Need to calculate estimated total cost before the user clicks "Run" using model pricing × estimated tokens × test case count.
5. **CloudFront → Lambda streaming:** Verify CloudFront passes through SSE correctly with no buffering. May need specific cache behaviors or `Transfer-Encoding: chunked`.

---

## 10. Future (v2) Considerations

Not in scope for POC, but architecturally accounted for:

- **User auth (Cognito):** Add when persistence is needed
- **Persistent results (DynamoDB):** Benchmark runs table, results table
- **Paid judge tier:** Upgrade to frontier models for production-grade scoring
- **Classifier model for routing:** Replace heuristics with a trained difficulty classifier
- **Async execution (SQS + Step Functions):** For large-scale benchmarks (100+ models)
- **Team/workspace support:** Multi-tenant isolation
- **API-first access:** REST API for CI/CD integration ("run benchmark on every PR")

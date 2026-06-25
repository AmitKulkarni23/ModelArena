# Adversarial Review: LLD Orchestrator Lambda

Reviewed: 2026-06-24
Source: `docs/system-specs/lld-orchestrator-lambda.md`

## Challenges

### 1. Race Condition in Composite Score Calculation — Severity: Critical

**Problem:** The scoring algorithm normalizes across all models (min-max scaling in `normalize_and_score`), but judge results arrive asynchronously. If a new model result arrives after normalization starts, the cached composite scores become stale and incorrect.

**Why it matters:** The `streaming_recommendation` event is calculated once, on-demand, after `run_benchmark` completes. However, nothing prevents judge results from still being processed when scoring begins. The `Arc<AtomicU32>` counters only track task completion, not dependencies. If judge task N finishes while recommendation is computing on incomplete judge task N+1, the min-max bounds are wrong, and models are mis-ranked. This affects the primary business logic — the routing recommendation. A user could route traffic to a suboptimal model based on incorrect scores.

**Suggested alternative:** Make score calculation two-phase explicit: (1) Wait for all judge results to complete via explicit join on all judge handles before entering scoring phase, (2) Only then compute composite scores. Change `run_benchmark` to collect all judge handles in a separate vec, join them explicitly with a timeout check (as already exists), then compute rankings only after the join. Add a sync point: replace the implicit "wait for some judge results" with explicit `futures::future::join_all(judge_handles).await` before `compute_rankings()` is called.

---

### 2. Judge Parse Fallback Assigns Neutral Scores Without Sufficient Validation — Severity: High

**Problem:** When judge response parsing fails, the code defaults all criteria to score 5 (neutral), but doesn't validate whether the judge actually attempted scoring or failed completely. A malformed response is indistinguishable from a neutral judgment.

**Why it matters:** The routing recommendation is built on these scores. If 30% of judge results silently default to 5.0, the actual quality distributions are masked, and recommendations become statistically meaningless. The HLD explicitly states "Take scores directionally, not as gospel" (implying known imprecision), but silent defaulting hides the actual parse failure rate. Operators won't know judges are misbehaving until they spot suspiciously neutral scores in the UI. Also, the 3-retry parsing strategy (direct JSON, markdown block, regex) is fragile — if OpenRouter judge returns something like `"Sorry, I can't evaluate that"`, all three strategies fail silently.

**Suggested alternative:** (1) Only apply the default-to-5 fallback if the parse attempt itself errors or times out. If the judge response parses successfully but is missing criteria, that's a different case—log it as a WARNING and include in the error event sent to frontend. (2) Return parse success/failure in the JudgeScores type: `struct JudgeScores { scores: Map<String, i32>, reasoning: String, is_fallback: bool }`. When `is_fallback` is true, include it in the SSE `judge_result` event so the frontend can mark those scores as "imputed". (3) Cap the fallback to max 1 per benchmark — if more than 1 judge result fails to parse, emit a critical error event and do not emit recommendation (safer than guessing).

---

### 3. Difficulty Classification Misses Easily Detectable Hard Cases — Severity: High

**Problem:** The difficulty classifier looks for specific keywords (e.g., "step by step", "prove", "calculate") but doesn't detect harder structures like multi-turn conversations, recursive problems, or constraint satisfaction. A prompt that requires the model to maintain context across multiple logical steps will incorrectly classify as "simple" if it doesn't contain the magic keywords.

**Why it matters:** The routing policy relies on difficulty classification to decide whether to use the frontier (better) or value (cheaper) model. If a complex reasoning task is misclassified as simple, it gets routed to the cheaper model, which may fail or produce low-quality outputs. Users see poor results and lose confidence in the recommendation. Conversely, over-classifying everything as hard defeats the cost-savings goal.

**Suggested alternative:** Add a token-count-based fallback: if `test_case_input + expected_output > 4000 chars` (~1000 tokens after system prompt), classify as hard regardless of keywords. This catches rambling, context-heavy prompts. Also add: check for imperative verb density — if >50% of sentences start with action verbs (e.g., "Write", "Build", "Analyze"), it's likely complex output generation. Example: `fn is_hard_by_structure(input: &str) -> bool { let sentences: Vec<_> = input.split_terminator('.').collect(); let action_count = sentences.iter().filter(|s| is_action_verb(s.trim().split_whitespace().next().unwrap_or(""))).count(); action_count as f64 / sentences.len() as f64 > 0.5 }`. This is still heuristic but catches more real cases.

---

### 4. SSE Channel Overflow Silently Drops Updates — Severity: High

**Problem:** The SSE channel has a fixed 100-event buffer. If the client disconnects or the browser stops consuming events, backpressure will cause `tx.send().await` to block. When the channel is full and the receiver side drops, sends will error. But the code doesn't handle this error — it will panic or silently continue, potentially missing event broadcasts.

**Why it matters:** In production, if a user closes the browser mid-benchmark, the Tokio tasks continue spawning events, trying to send to a dead channel. The Lambda keeps running until timeout, burning compute costs and leaving results incomplete in the CloudWatch logs but not in the UI. If this happens repeatedly, the Lambda will hit its 5-minute timeout and be killed, with no graceful shutdown.

**Suggested alternative:** (1) Catch `tx.send()` errors explicitly. When send fails (channel closed), log a critical error and immediately cancel all pending tasks via a shared `CancellationToken` (tokio_util::sync::CancellationToken). (2) Wrap the benchmark runner in `tokio::select! { ... cancel_token.cancelled() => { ... } }` to interrupt on cancellation. (3) Return early from `run_benchmark` when the stream closes, allowing the Lambda to exit cleanly. (4) Set channel buffer to 500 to reduce contention, but still monitor for overflow.

---

### 5. No Timeout or Failure Recovery for Slow Judge Models — Severity: Medium

**Problem:** Judge model calls have no per-call timeout — they inherit the 120-second timeout from the OpenRouter client, but there's no retry strategy specific to free-tier rate limits. The code retries once on 429 after 2–3 seconds, then skips. If all 3 judge models are rate-limited simultaneously, the benchmark completes with 0 scores for a model, yet the code doesn't detect this failure mode.

**Why it matters:** A model with zero judge results still gets included in the rankings (with default neutral scores via `avg_quality = 5.0`). This inflates the diversity of the recommendation and may suggest a model is "average" when it actually failed to be judged. The routing policy reasoning won't mention that judge failures caused the poor ranking. Users won't know whether to trust the recommendation or retry.

**Suggested alternative:** (1) Track judge result counts per model in the aggregation phase. If a model has fewer judge results than expected (< judge_models.len() × test_cases.len()), include a confidence score in the ModelRanking: `confidence: f64` (e.g., 0.67 if 2 of 3 judges succeeded). (2) In the recommendation output, add a field: `has_missing_data: Vec<String>` listing models with incomplete judgments. (3) If any model has confidence < 0.5, add a note to the recommendation reasoning: "Some models have incomplete judge data — rerun for full confidence."

---

## Summary

The design is functional but has three critical-to-high severity issues that will cause incorrect recommendations or failed operations in production:

1. **Race condition in scoring** prevents reliable ranking.
2. **Silent judge parse failures** hide data quality issues.
3. **Difficulty classification is too narrow** and misses real hard cases.
4. **SSE channel overflow** causes resource leaks.
5. **No judge failure detection** masks incomplete data.

Issues 1, 2, and 4 are must-fix before any load testing. Issues 3 and 5 are must-fix before production use (they corrupt the core value prop: accurate recommendations).

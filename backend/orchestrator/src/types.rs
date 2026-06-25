use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize)]
pub struct BenchmarkRequest {
    pub system_prompt: String,
    pub test_cases: Vec<TestCase>,
    pub models: Vec<String>,
    pub judge_models: Option<Vec<String>>,
    pub rubric_criteria: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TestCase {
    pub input: String,
    pub expected_output: Option<String>,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkStartedData {
    pub total_tasks: u32,
    pub total_judge_tasks: u32,
    pub estimated_cost_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelResultData {
    pub model_id: String,
    pub test_case_idx: u32,
    pub response: String,
    pub latency_ms: u64,
    pub ttfb_ms: u64,
    pub tokens_in: u32,
    pub tokens_out: u32,
    pub cost_usd: f64,
    pub completed: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JudgeResultData {
    pub model_id: String,
    pub test_case_idx: u32,
    pub judge_model_id: String,
    pub scores: HashMap<String, u32>,
    pub reasoning: String,
    pub is_fallback: bool,
    pub completed: u32,
    pub total: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecommendationData {
    pub rankings: Vec<ModelRanking>,
    pub routing_policy: RoutingPolicy,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRanking {
    pub model_id: String,
    pub avg_quality: f64,
    pub avg_latency_ms: f64,
    pub total_cost_usd: f64,
    pub cost_per_1k_tokens: f64,
    pub composite_score: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingPolicy {
    pub primary_model: String,
    pub primary_traffic_pct: u32,
    pub frontier_model: String,
    pub frontier_traffic_pct: u32,
    pub estimated_savings_pct: u32,
    pub difficulty_threshold: Vec<String>,
    pub incomplete_models: Vec<String>,
    pub reasoning: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkErrorData {
    pub model_id: Option<String>,
    pub test_case_idx: Option<u32>,
    pub judge_model_id: Option<String>,
    pub error_code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data")]
pub enum SseEventData {
    #[serde(rename = "benchmark_started")]
    BenchmarkStarted(BenchmarkStartedData),

    #[serde(rename = "model_result")]
    ModelResult(ModelResultData),

    #[serde(rename = "judge_result")]
    JudgeResult(JudgeResultData),

    #[serde(rename = "recommendation")]
    Recommendation(RecommendationData),

    #[serde(rename = "error")]
    Error(BenchmarkErrorData),

    #[serde(rename = "done")]
    Done,
}

#[derive(Debug, Clone)]
pub struct JudgeScores {
    pub scores: HashMap<String, u32>,
    pub reasoning: String,
    pub is_fallback: bool,
}

#[derive(Debug, Clone)]
pub struct CompletionResponse {
    pub content: String,
    pub tokens_in: u32,
    pub tokens_out: u32,
    pub latency_ms: u64,
    pub ttfb_ms: u64,
}

#[derive(Debug, Clone)]
pub struct ModelPricing {
    pub prompt: f64,
    pub completion: f64,
}

#[derive(Debug, Clone)]
pub struct InternalModelResult {
    pub model_id: String,
    pub test_case_idx: u32,
    pub response: String,
    pub latency_ms: u64,
    pub tokens_in: u32,
    pub tokens_out: u32,
    pub cost_usd: f64,
}

#[derive(Debug, Clone)]
pub struct InternalJudgeResult {
    pub model_id: String,
    pub test_case_idx: u32,
    pub judge_model_id: String,
    pub scores: HashMap<String, u32>,
    pub reasoning: String,
    pub is_fallback: bool,
}

#[derive(Debug, Deserialize)]
pub struct OpenRouterModel {
    pub id: String,
    pub pricing: OpenRouterPricing,
}

#[derive(Debug, Deserialize)]
pub struct OpenRouterPricing {
    pub prompt: String,
    pub completion: String,
}

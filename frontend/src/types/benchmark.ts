export interface TestCase {
  input: string;
  expected_output?: string;
  label?: string;
}

export interface BenchmarkConfig {
  system_prompt: string;
  test_cases: TestCase[];
  model_ids: string[];
  judge_model_ids?: string[];
  rubric_criteria?: string[];
}

export interface BenchmarkRequest {
  system_prompt: string;
  test_cases: TestCase[];
  model_ids: string[];
  judge_model_ids?: string[];
  rubric_criteria?: string[];
}

export interface BenchmarkStartedEvent {
  benchmark_id: string;
  model_ids: string[];
  test_case_count: number;
  judge_model_ids: string[];
}

export interface ModelResultEvent {
  benchmark_id: string;
  model_id: string;
  test_case_idx: number;
  response: string;
  latency_ms: number;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export interface JudgeResultEvent {
  benchmark_id: string;
  model_id: string;
  test_case_idx: number;
  judge_model_id: string;
  score: number;
  reasoning: string;
  criterion_scores?: Record<string, number>;
}

export interface RecommendationEvent {
  primary_model_id: string;
  primary_model_name: string;
  frontier_model_id: string;
  frontier_model_name: string;
  traffic_split: number;
  estimated_cost_savings_pct: number;
  difficulty_signals: string[];
  reasoning: string;
}

export interface BenchmarkErrorEvent {
  benchmark_id: string;
  model_id?: string;
  test_case_idx?: number;
  error_type: string;
  message: string;
}

export interface ModelRanking {
  model_id: string;
  model_name: string;
  rank: number;
  avg_quality: number;
  avg_latency_ms: number;
  total_cost_usd: number;
  cost_per_1k_tokens: number;
  composite_score: number;
}

export interface RoutingPolicy {
  primary_model_id: string;
  frontier_model_id: string;
  traffic_split: number;
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

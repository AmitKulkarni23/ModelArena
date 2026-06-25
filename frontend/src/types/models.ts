export interface Pricing {
  prompt_per_million: number;
  completion_per_million: number;
}

export interface ModelSummary {
  id: string;
  name: string;
  provider: string;
  context_length: number;
  pricing: Pricing;
  modality: "text" | "multimodal";
  is_free: boolean;
}

export interface ModelsQuery {
  search?: string;
  modality?: "text" | "multimodal";
  provider?: string;
  max_price?: number;
  free_only?: boolean;
}

export interface ModelsResponse {
  models: ModelSummary[];
  total: number;
}

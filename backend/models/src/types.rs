use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct ModelsQuery {
    pub search: Option<String>,
    pub max_price: Option<f64>,
    pub min_context: Option<u32>,
    pub modality: Option<String>,
    pub free_only: Option<bool>,
    pub provider: Option<String>,
    pub supports_tools: Option<bool>,
    pub sort_by: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelsResponse {
    pub models: Vec<ModelSummary>,
    pub total: u32,
    pub cached_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSummary {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub context_length: u32,
    pub max_completion_tokens: Option<u32>,
    pub modality: String,
    pub pricing: ModelPricing,
    pub supports_tools: bool,
    pub supports_streaming: bool,
    pub is_free: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPricing {
    pub prompt_per_million: f64,
    pub completion_per_million: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenRouterModel {
    pub id: String,
    pub name: String,
    pub context_length: u32,
    pub max_completion_tokens: Option<u32>,
    pub modality: String,
    pub pricing: OpenRouterPricing,
    pub supported_generation_methods: Vec<String>,
    pub architecture: Option<OpenRouterArchitecture>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenRouterPricing {
    pub prompt: String,
    pub completion: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OpenRouterArchitecture {
    pub modality: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

impl ModelSummary {
    pub fn from(model: OpenRouterModel) -> Self {
        let provider = model.id.split('/').next().unwrap_or("unknown").to_string();
        let is_free = model.pricing.prompt == "0" || model.pricing.prompt.is_empty();

        let prompt_price = model.pricing.prompt.parse::<f64>().unwrap_or(0.0);
        let completion_price = model.pricing.completion.parse::<f64>().unwrap_or(0.0);

        Self {
            id: model.id,
            name: model.name,
            provider,
            context_length: model.context_length,
            max_completion_tokens: model.max_completion_tokens,
            modality: model.modality,
            pricing: ModelPricing {
                prompt_per_million: prompt_price * 1_000_000.0,
                completion_per_million: completion_price * 1_000_000.0,
            },
            supports_tools: model
                .supported_generation_methods
                .iter()
                .any(|m| m.contains("tool") || m.contains("function")),
            supports_streaming: model
                .supported_generation_methods
                .iter()
                .any(|m| m.contains("stream")),
            is_free,
        }
    }
}

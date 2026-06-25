use crate::types::{ModelsQuery, OpenRouterModel};

pub fn apply_filters(models: &[OpenRouterModel], query: &ModelsQuery) -> Vec<OpenRouterModel> {
    models
        .iter()
        .filter(|m| match_search(m, &query.search))
        .filter(|m| match_max_price(m, query.max_price, query.free_only))
        .filter(|m| match_min_context(m, query.min_context))
        .filter(|m| match_modality(m, &query.modality))
        .filter(|m| match_provider(m, &query.provider))
        .filter(|m| match_supports_tools(m, query.supports_tools))
        .cloned()
        .collect()
}

fn match_search(model: &OpenRouterModel, query: &Option<String>) -> bool {
    match query {
        None => true,
        Some(q) => {
            let q_lower = q.to_lowercase();
            model.id.to_lowercase().contains(&q_lower)
                || model.name.to_lowercase().contains(&q_lower)
        }
    }
}

fn match_max_price(
    model: &OpenRouterModel,
    max_price: Option<f64>,
    free_only: Option<bool>,
) -> bool {
    if free_only == Some(true) {
        return parse_price(&model.pricing.prompt) == 0.0 && parse_price(&model.pricing.completion) == 0.0;
    }

    match max_price {
        None => true,
        Some(max) => {
            let prompt_price = parse_price(&model.pricing.prompt);
            prompt_price <= max
        }
    }
}

fn match_min_context(model: &OpenRouterModel, min_context: Option<u32>) -> bool {
    match min_context {
        None => true,
        Some(min) => model.context_length >= min,
    }
}

fn match_modality(model: &OpenRouterModel, modality: &Option<String>) -> bool {
    match modality {
        None => true,
        Some(m) => model
            .architecture
            .as_ref()
            .and_then(|a| a.modality.as_ref())
            .map(|am| am.to_lowercase().contains(&m.to_lowercase()))
            .unwrap_or(false),
    }
}

fn match_provider(model: &OpenRouterModel, provider: &Option<String>) -> bool {
    match provider {
        None => true,
        Some(p) => model.id.to_lowercase().starts_with(&p.to_lowercase()),
    }
}

fn match_supports_tools(model: &OpenRouterModel, supports_tools: Option<bool>) -> bool {
    match supports_tools {
        None => true,
        Some(true) => model
            .supported_parameters
            .as_deref()
            .unwrap_or(&[])
            .iter()
            .any(|p| p.contains("tool") || p.contains("function")),
        Some(false) => true,
    }
}

fn parse_price(price_str: &str) -> f64 {
    price_str.parse::<f64>().unwrap_or(0.0)
}

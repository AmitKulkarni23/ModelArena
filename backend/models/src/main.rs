mod cache;
mod filter;
mod openrouter;
mod types;

use cache::get_models;
use filter::apply_filters;
use lambda_http::{service_fn, Body, Request, Response, http::StatusCode};
use openrouter::OpenRouterClient;
use std::env;
use tracing::{error, info};
use types::{ErrorResponse, ModelSummary, ModelsQuery, ModelsResponse};

#[tokio::main]
async fn main() {
    init_tracing();

    let handler = service_fn(handler);
    lambda_http::run(handler)
        .await
        .expect("Lambda runtime failed");
}

async fn handler(req: Request) -> Result<Response<Body>, lambda_http::Error> {
    info!("Incoming request: {} {}", req.method(), req.uri());

    // Check origin verification header
    let origin_verify = env::var("CLOUDFRONT_ORIGIN_VERIFY").unwrap_or_default();
    if !origin_verify.is_empty() {
        match req.headers().get("X-Origin-Verify") {
            Some(header_val) => {
                if header_val.to_str().unwrap_or("") != origin_verify {
                    error!("Origin verification failed");
                    return Ok(error_response(
                        StatusCode::FORBIDDEN,
                        "origin_verification_failed",
                        "Invalid origin",
                    ));
                }
            }
            None => {
                error!("Missing origin verification header");
                return Ok(error_response(
                    StatusCode::FORBIDDEN,
                    "origin_verification_failed",
                    "Missing origin header",
                ));
            }
        }
    }

    // Parse query parameters
    let query = parse_query(req.uri().query());

    // Validate query parameters
    if let Err(e) = validate_query(&query) {
        return Ok(error_response(StatusCode::BAD_REQUEST, "invalid_query", &e));
    }

    // Initialize OpenRouter client
    let api_key = match env::var("OPENROUTER_API_KEY") {
        Ok(k) => k,
        Err(_) => {
            error!("Missing OPENROUTER_API_KEY");
            return Ok(error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "missing_api_key",
                "API key not configured",
            ));
        }
    };

    let client = OpenRouterClient::new(api_key);

    // Fetch models from cache
    let models = match get_models(&client).await {
        Ok(m) => m,
        Err(e) => {
            error!("Failed to fetch models: {:?}", e);
            return Ok(error_response(
                StatusCode::BAD_GATEWAY,
                "upstream_unavailable",
                "Failed to fetch model catalog",
            ));
        }
    };

    // Apply filters
    let mut filtered = apply_filters(&models, &query);

    // Apply sorting
    apply_sort(&mut filtered, &query.sort_by);

    // Calculate total before pagination
    let total = filtered.len() as u32;

    // Apply pagination
    let offset = query.offset.unwrap_or(0) as usize;
    let limit = std::cmp::min(query.limit.unwrap_or(50), 200) as usize;

    if offset >= filtered.len() {
        filtered.clear();
    } else {
        filtered = filtered[offset..std::cmp::min(offset + limit, filtered.len())].to_vec();
    }

    // Map to ModelSummary
    let model_summaries: Vec<ModelSummary> = filtered
        .into_iter()
        .map(|m| ModelSummary::from(m))
        .collect();

    let response_data = ModelsResponse {
        models: model_summaries,
        total,
        cached_at: chrono::Utc::now().to_rfc3339(),
    };

    let body = serde_json::to_string(&response_data)
        .expect("Failed to serialize response");

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Allow-Methods", "GET, OPTIONS")
        .header("Access-Control-Allow-Headers", "Content-Type")
        .body(Body::from(body))
        .expect("Failed to build response"))
}

fn init_tracing() {
    let rust_log = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(rust_log)
        .json()
        .init();
}

fn parse_query(query_str: Option<&str>) -> ModelsQuery {
    let mut query = ModelsQuery {
        search: None,
        max_price: None,
        min_context: None,
        modality: None,
        free_only: None,
        provider: None,
        supports_tools: None,
        sort_by: None,
        limit: None,
        offset: None,
    };

    if let Some(qs) = query_str {
        for param in qs.split('&') {
            if let Some((key, value)) = param.split_once('=') {
                let decoded_value = urlencoding::decode(value)
                    .unwrap_or_default()
                    .into_owned();

                match key {
                    "search" => query.search = Some(decoded_value),
                    "max_price" => query.max_price = decoded_value.parse().ok(),
                    "min_context" => query.min_context = decoded_value.parse().ok(),
                    "modality" => query.modality = Some(decoded_value),
                    "free_only" => {
                        query.free_only = Some(decoded_value.to_lowercase() == "true")
                    }
                    "provider" => query.provider = Some(decoded_value),
                    "supports_tools" => {
                        query.supports_tools = Some(decoded_value.to_lowercase() == "true")
                    }
                    "sort_by" => query.sort_by = Some(decoded_value),
                    "limit" => query.limit = decoded_value.parse().ok(),
                    "offset" => query.offset = decoded_value.parse().ok(),
                    _ => {}
                }
            }
        }
    }

    query
}

fn validate_query(query: &ModelsQuery) -> Result<(), String> {
    if let Some(price) = query.max_price {
        if price < 0.0 {
            return Err("max_price must be non-negative".to_string());
        }
    }

    if let Some(context) = query.min_context {
        if context == 0 {
            return Err("min_context must be positive".to_string());
        }
    }

    if let Some(limit) = query.limit {
        if limit == 0 || limit > 200 {
            return Err("limit must be 1-200".to_string());
        }
    }

    Ok(())
}

fn apply_sort(models: &mut [types::OpenRouterModel], sort_by: &Option<String>) {
    match sort_by.as_deref() {
        Some("price_asc") => {
            models.sort_by(|a, b| {
                let a_price = a.pricing.prompt.parse::<f64>().unwrap_or(f64::MAX);
                let b_price = b.pricing.prompt.parse::<f64>().unwrap_or(f64::MAX);
                a_price.partial_cmp(&b_price).unwrap_or(std::cmp::Ordering::Equal)
            });
        }
        Some("price_desc") => {
            models.sort_by(|a, b| {
                let a_price = a.pricing.prompt.parse::<f64>().unwrap_or(0.0);
                let b_price = b.pricing.prompt.parse::<f64>().unwrap_or(0.0);
                b_price.partial_cmp(&a_price).unwrap_or(std::cmp::Ordering::Equal)
            });
        }
        Some("context_desc") => {
            models.sort_by(|a, b| b.context_length.cmp(&a.context_length));
        }
        Some("name_asc") | None => {
            models.sort_by(|a, b| a.name.cmp(&b.name));
        }
        _ => {}
    }
}

fn error_response(status: StatusCode, error: &str, message: &str) -> Response<Body> {
    let error_data = ErrorResponse {
        error: error.to_string(),
        message: message.to_string(),
    };

    let body = serde_json::to_string(&error_data).unwrap_or_else(|_| "{}".to_string());

    Response::builder()
        .status(status)
        .header("Content-Type", "application/json")
        .header("Access-Control-Allow-Origin", "*")
        .body(Body::from(body))
        .expect("Failed to build error response")
}

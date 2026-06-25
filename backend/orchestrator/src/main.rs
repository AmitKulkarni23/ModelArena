mod fanout;
mod judge;
mod openrouter;
mod routing;
mod scoring;
mod sse;
mod types;
mod validation;

use bytes::Bytes;
use fanout::{fan_out_model_calls, fan_out_judge_calls};
use lambda_http::http::StatusCode;
use lambda_http::{service_fn, Body, Request, Response};
use lambda_runtime::Error;
use openrouter::OpenRouterClient;
use routing::recommend_routing;
use scoring::compute_rankings;
use sse::event_to_sse_bytes;
use std::env;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;
use tracing::{error, info};
use types::{BenchmarkRequest, BenchmarkErrorData, RecommendationData, SseEventData};
use validation::validate_benchmark_request;

#[tokio::main]
async fn main() -> Result<(), Error> {
    init_tracing();
    lambda_http::run(service_fn(handler)).await
}

async fn handler(req: Request) -> Result<Response<Body>, Error> {
    info!("Benchmark request received");

    // Verify origin
    let origin_verify = env::var("CLOUDFRONT_ORIGIN_VERIFY").unwrap_or_default();
    if !origin_verify.is_empty() {
        if let Some(header_val) = req.headers().get("X-Origin-Verify") {
            if header_val.to_str().unwrap_or("") != origin_verify {
                error!("Origin verification failed");
                return Ok(Response::builder()
                    .status(StatusCode::FORBIDDEN)
                    .body(Body::from("Invalid origin"))
                    .unwrap());
            }
        } else {
            error!("Missing origin verification header");
            return Ok(Response::builder()
                .status(StatusCode::FORBIDDEN)
                .body(Body::from("Missing origin header"))
                .unwrap());
        }
    }

    // Parse request body
    let body_str = std::str::from_utf8(req.body()).unwrap_or("");
    let config: BenchmarkRequest = match serde_json::from_str(body_str) {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to parse request body: {}", e);
            return Ok(Response::builder()
                .status(StatusCode::BAD_REQUEST)
                .body(Body::from(format!("Invalid request body: {}", e)))
                .unwrap());
        }
    };

    // Validate request
    if let Err(e) = validate_benchmark_request(&config) {
        error!("Validation failed: {}", e);
        return Ok(Response::builder()
            .status(StatusCode::BAD_REQUEST)
            .body(Body::from(format!("Validation error: {}", e)))
            .unwrap());
    }

    // Initialize OpenRouter client
    let api_key = match env::var("OPENROUTER_API_KEY") {
        Ok(k) => k,
        Err(_) => {
            error!("Missing OPENROUTER_API_KEY");
            return Ok(Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .body(Body::from("API key not configured"))
                .unwrap());
        }
    };

    let client = Arc::new(OpenRouterClient::new(api_key));

    // Create SSE channel
    let (tx, mut rx) = mpsc::channel::<Bytes>(100);

    // Create cancellation token
    let cancel = CancellationToken::new();

    // Spawn benchmark runner
    let cancel_clone = cancel.clone();
    let client_clone = client.clone();
    tokio::spawn(async move {
        if let Err(e) = run_benchmark(config, tx, client_clone, cancel_clone).await {
            error!("Benchmark failed: {}", e);
        }
    });

    // Collect all events from the channel into a single response body
    let mut events = Vec::new();
    while let Some(event_bytes) = rx.recv().await {
        events.push(event_bytes);
    }

    let body = Body::from(events.into_iter().map(|b| b.to_vec()).collect::<Vec<_>>().concat());

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .body(body)
        .unwrap())
}

async fn run_benchmark(
    config: BenchmarkRequest,
    tx: mpsc::Sender<Bytes>,
    client: Arc<OpenRouterClient>,
    cancel: CancellationToken,
) -> Result<(), String> {
    // Fetch model pricing
    let mut all_model_ids = config.models.clone();
    if let Some(ref judges) = config.judge_models {
        all_model_ids.extend(judges.clone());
    }

    let pricing = client.fetch_model_pricing(&all_model_ids).await?;

    // Estimate cost
    let estimated_cost = estimate_cost(&config, &pricing);

    let total_model_tasks = (config.models.len() * config.test_cases.len()) as u32;
    let judge_models_count = config
        .judge_models
        .as_ref()
        .map(|j| j.len())
        .unwrap_or(2);
    let total_judge_tasks = (total_model_tasks as usize * judge_models_count) as u32;

    // Send benchmark_started event
    let started_event = SseEventData::BenchmarkStarted(types::BenchmarkStartedData {
        total_tasks: total_model_tasks,
        total_judge_tasks,
        estimated_cost_usd: estimated_cost,
    });

    if tx.send(event_to_sse_bytes(&started_event)).await.is_err() {
        return Ok(()); // Client disconnected
    }

    // Phase 1: Fan out model calls
    info!("Starting model calls");
    let model_results = fan_out_model_calls(client.clone(), &config, &pricing, &tx, &cancel).await;

    if model_results.is_empty() {
        let error_event = SseEventData::Error(BenchmarkErrorData {
            model_id: None,
            test_case_idx: None,
            judge_model_id: None,
            error_code: "all_models_failed".to_string(),
            message: "All model calls failed".to_string(),
        });

        let _ = tx.send(event_to_sse_bytes(&error_event)).await;
        let _ = tx.send(event_to_sse_bytes(&SseEventData::Done)).await;
        return Ok(());
    }

    // Phase 2: Fan out judge calls, then join all
    info!("Starting judge calls");
    let judge_results = fan_out_judge_calls(client.clone(), &model_results, &config, &tx, &cancel).await;

    // Phase 3: Compute rankings (only after judge_results are complete)
    info!("Computing rankings");
    let rankings = compute_rankings(&model_results, &judge_results, &pricing);

    // Phase 4: Recommendation
    let routing_policy = recommend_routing(&rankings, &config.test_cases);

    let summary = format!(
        "Best value model: {} (composite: {:.2}). Best quality: {} (quality: {:.1}/10). {}",
        rankings.first().map(|r| &r.model_id).unwrap_or(&"unknown".to_string()),
        rankings.first().map(|r| r.composite_score).unwrap_or(0.0),
        rankings.first().map(|r| &r.model_id).unwrap_or(&"unknown".to_string()),
        rankings.first().map(|r| r.avg_quality).unwrap_or(0.0),
        routing_policy.reasoning
    );

    let recommendation = SseEventData::Recommendation(RecommendationData {
        rankings,
        routing_policy,
        summary,
    });

    if tx.send(event_to_sse_bytes(&recommendation)).await.is_err() {
        return Ok(());
    }

    // Send done event
    let _ = tx.send(event_to_sse_bytes(&SseEventData::Done)).await;

    info!("Benchmark completed");
    Ok(())
}

fn estimate_cost(config: &BenchmarkRequest, pricing: &std::collections::HashMap<String, types::ModelPricing>) -> f64 {
    let estimated_output_tokens = 500;
    let mut total = 0.0;

    for model_id in &config.models {
        let model_pricing = pricing
            .get(model_id)
            .cloned()
            .unwrap_or(types::ModelPricing {
                prompt: 0.0,
                completion: 0.0,
            });

        for test_case in &config.test_cases {
            let prompt_tokens = (config.system_prompt.len() + test_case.input.len()) / 4;
            let completion_tokens = estimated_output_tokens;

            let model_cost = (prompt_tokens as f64 * model_pricing.prompt)
                + (completion_tokens as f64 * model_pricing.completion);

            total += model_cost;
        }
    }

    total
}

fn init_tracing() {
    let rust_log = env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(rust_log)
        .json()
        .init();
}

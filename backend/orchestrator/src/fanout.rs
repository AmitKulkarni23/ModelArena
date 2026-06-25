use crate::types::{InternalModelResult, InternalJudgeResult, ModelPricing, SseEventData, ModelResultData, JudgeResultData};
use crate::openrouter::OpenRouterClient;
use crate::judge::judge_response;
use crate::sse::event_to_sse_bytes;
use crate::types::BenchmarkRequest;
use bytes::Bytes;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use tokio::sync::{mpsc::Sender, Semaphore};
use tokio_util::sync::CancellationToken;

pub async fn fan_out_model_calls(
    client: Arc<OpenRouterClient>,
    config: &BenchmarkRequest,
    pricing: &HashMap<String, ModelPricing>,
    tx: &Sender<Bytes>,
    cancel: &CancellationToken,
) -> Vec<InternalModelResult> {
    let semaphore = Arc::new(Semaphore::new(20));
    let counter = Arc::new(AtomicU32::new(0));
    let total = (config.models.len() * config.test_cases.len()) as u32;

    let mut handles = Vec::new();

    for (tc_idx, test_case) in config.test_cases.iter().enumerate() {
        for model_id in &config.models {
            let semaphore_clone = Arc::clone(&semaphore);
            let client_clone = Arc::clone(&client);
            let model_id_clone = model_id.clone();
            let counter_clone = Arc::clone(&counter);
            let system_prompt = config.system_prompt.clone();
            let test_input = test_case.input.clone();
            let pricing_clone = pricing.clone();
            let tx_clone = tx.clone();
            let cancel_clone = cancel.clone();

            let handle = tokio::spawn(async move {
                tokio::select! {
                    result = async {
                        let _permit = semaphore_clone.acquire_owned().await.ok()?;
                        let resp = client_clone
                            .chat_completion(&model_id_clone, &system_prompt, &test_input)
                            .await
                            .ok()?;
                        Some((resp, _permit))
                    } => {
                        if let Some((resp, _permit)) = result {
                            let model_pricing = pricing_clone.get(&model_id_clone)
                                .cloned()
                                .unwrap_or(ModelPricing { prompt: 0.0, completion: 0.0 });

                            let cost_usd = (resp.tokens_in as f64 * model_pricing.prompt)
                                + (resp.tokens_out as f64 * model_pricing.completion);

                            let completed = counter_clone.fetch_add(1, Ordering::Relaxed) + 1;

                            let event_data = ModelResultData {
                                model_id: model_id_clone.clone(),
                                test_case_idx: tc_idx as u32,
                                response: resp.content.clone(),
                                latency_ms: resp.latency_ms,
                                ttfb_ms: resp.ttfb_ms,
                                tokens_in: resp.tokens_in,
                                tokens_out: resp.tokens_out,
                                cost_usd,
                                completed,
                                total,
                            };

                            let event = SseEventData::ModelResult(event_data.clone());
                            let bytes = event_to_sse_bytes(&event);

                            if tx_clone.send(bytes).await.is_err() {
                                cancel_clone.cancel();
                                return None;
                            }

                            Some(InternalModelResult {
                                model_id: model_id_clone,
                                test_case_idx: tc_idx as u32,
                                response: resp.content,
                                latency_ms: resp.latency_ms,
                                tokens_in: resp.tokens_in,
                                tokens_out: resp.tokens_out,
                                cost_usd,
                            })
                        } else {
                            None
                        }
                    }

                    _ = cancel_clone.cancelled() => {
                        return None;
                    }
                }
            });

            handles.push(handle);
        }
    }

    let results: Vec<InternalModelResult> = futures::future::join_all(handles)
        .await
        .into_iter()
        .filter_map(|r| r.ok().flatten())
        .collect();

    results
}

pub async fn fan_out_judge_calls(
    client: Arc<OpenRouterClient>,
    model_results: &[InternalModelResult],
    config: &BenchmarkRequest,
    tx: &Sender<Bytes>,
    cancel: &CancellationToken,
) -> Vec<InternalJudgeResult> {
    let semaphore = Arc::new(Semaphore::new(5));
    let counter = Arc::new(AtomicU32::new(0));
    let total = (model_results.len() * config.judge_models.as_ref().unwrap_or(&vec![]).len()) as u32;

    let judge_models = config.judge_models.as_ref()
        .cloned()
        .unwrap_or_else(|| vec![
            "meta-llama/llama-4-maverick:free".to_string(),
            "google/gemma-3-27b-it:free".to_string(),
        ]);

    let rubric_criteria = config.rubric_criteria.as_ref()
        .cloned()
        .unwrap_or_else(|| vec![
            "relevance".to_string(),
            "accuracy".to_string(),
            "completeness".to_string(),
        ]);

    let mut handles = Vec::new();

    for (model_result_idx, model_result) in model_results.iter().enumerate() {
        let test_case = &config.test_cases[model_result_idx];

        for judge_model in &judge_models {
            let semaphore_clone = Arc::clone(&semaphore);
            let client_clone = Arc::clone(&client);
            let judge_model_clone = judge_model.clone();
            let counter_clone = Arc::clone(&counter);
            let system_prompt = config.system_prompt.clone();
            let test_input = test_case.input.clone();
            let expected_output = test_case.expected_output.clone();
            let model_response = model_result.response.clone();
            let model_id = model_result.model_id.clone();
            let test_case_idx = model_result.test_case_idx;
            let rubric = rubric_criteria.clone();
            let tx_clone = tx.clone();
            let cancel_clone = cancel.clone();

            let handle = tokio::spawn(async move {
                tokio::select! {
                    result = async {
                        let _permit = semaphore_clone.acquire_owned().await.ok()?;
                        judge_response(
                            &client_clone,
                            &judge_model_clone,
                            &system_prompt,
                            &test_input,
                            expected_output.as_deref(),
                            &model_response,
                            &rubric,
                        )
                        .await
                        .ok()
                    } => {
                        if let Some(judge_scores) = result {
                            let completed = counter_clone.fetch_add(1, Ordering::Relaxed) + 1;

                            let event_data = JudgeResultData {
                                model_id: model_id.clone(),
                                test_case_idx,
                                judge_model_id: judge_model_clone.clone(),
                                scores: judge_scores.scores.clone(),
                                reasoning: judge_scores.reasoning.clone(),
                                is_fallback: judge_scores.is_fallback,
                                completed,
                                total,
                            };

                            let event = SseEventData::JudgeResult(event_data.clone());
                            let bytes = event_to_sse_bytes(&event);

                            if tx_clone.send(bytes).await.is_err() {
                                cancel_clone.cancel();
                                return None;
                            }

                            Some(InternalJudgeResult {
                                model_id,
                                test_case_idx,
                                judge_model_id: judge_model_clone,
                                scores: judge_scores.scores,
                                reasoning: judge_scores.reasoning,
                                is_fallback: judge_scores.is_fallback,
                            })
                        } else {
                            None
                        }
                    }

                    _ = cancel_clone.cancelled() => {
                        return None;
                    }
                }
            });

            handles.push(handle);
        }
    }

    let results: Vec<InternalJudgeResult> = futures::future::join_all(handles)
        .await
        .into_iter()
        .filter_map(|r| r.ok().flatten())
        .collect();

    results
}

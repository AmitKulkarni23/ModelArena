use crate::types::{CompletionResponse, OpenRouterModel, ModelPricing};
use reqwest::Client;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tracing::{error, warn};

pub struct OpenRouterClient {
    http: Client,
    api_key: String,
    base_url: String,
}

impl OpenRouterClient {
    pub fn new(api_key: String) -> Self {
        let http = Client::new();
        Self {
            http,
            api_key,
            base_url: "https://openrouter.ai/api/v1".to_string(),
        }
    }

    pub async fn chat_completion(
        &self,
        model_id: &str,
        system_prompt: &str,
        user_input: &str,
    ) -> Result<CompletionResponse, String> {
        let start = Instant::now();

        let chat_request = ChatRequest {
            model: model_id.to_string(),
            messages: vec![
                Message {
                    role: "system".to_string(),
                    content: system_prompt.to_string(),
                },
                Message {
                    role: "user".to_string(),
                    content: user_input.to_string(),
                },
            ],
        };

        let url = format!("{}/chat/completions", self.base_url);

        match self
            .http
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&chat_request)
            .timeout(Duration::from_secs(120))
            .send()
            .await
        {
            Ok(response) => {
                let status = response.status();
                if !status.is_success() {
                    error!(
                        "OpenRouter chat completion returned status {}",
                        status.as_u16()
                    );
                    return Err(format!("HTTP {}", status.as_u16()));
                }

                match response.json::<ChatResponse>().await {
                    Ok(chat_response) => {
                        let latency_ms = start.elapsed().as_millis() as u64;
                        let content = chat_response.choices[0].message.content.clone();

                        Ok(CompletionResponse {
                            content,
                            tokens_in: chat_response.usage.prompt_tokens,
                            tokens_out: chat_response.usage.completion_tokens,
                            latency_ms,
                            ttfb_ms: 0, // POC: total latency only
                        })
                    }
                    Err(e) => {
                        error!("Failed to parse chat completion response: {}", e);
                        Err(format!("Parse error: {}", e))
                    }
                }
            }
            Err(e) => {
                error!("Chat completion request failed: {}", e);
                Err(e.to_string())
            }
        }
    }

    pub async fn fetch_model_pricing(
        &self,
        model_ids: &[String],
    ) -> Result<HashMap<String, ModelPricing>, String> {
        let url = format!("{}/models", self.base_url);

        match self
            .http
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .timeout(Duration::from_secs(10))
            .send()
            .await
        {
            Ok(response) => {
                if !response.status().is_success() {
                    return Err("Failed to fetch model pricing".to_string());
                }

                match response.json::<ModelsListResponse>().await {
                    Ok(data) => {
                        let mut pricing_map = HashMap::new();

                        for model_spec in data.data {
                            if model_ids.contains(&model_spec.id) {
                                let prompt =
                                    model_spec.pricing.prompt.parse::<f64>().unwrap_or(0.0);
                                let completion = model_spec
                                    .pricing
                                    .completion
                                    .parse::<f64>()
                                    .unwrap_or(0.0);

                                pricing_map.insert(
                                    model_spec.id,
                                    ModelPricing { prompt, completion },
                                );
                            }
                        }

                        // Fill in missing models with 0 pricing
                        for model_id in model_ids {
                            if !pricing_map.contains_key(model_id) {
                                pricing_map.insert(
                                    model_id.clone(),
                                    ModelPricing {
                                        prompt: 0.0,
                                        completion: 0.0,
                                    },
                                );
                            }
                        }

                        Ok(pricing_map)
                    }
                    Err(e) => {
                        warn!("Failed to parse pricing response: {}", e);
                        // Return default zero pricing for all models
                        let mut default_pricing = HashMap::new();
                        for model_id in model_ids {
                            default_pricing.insert(
                                model_id.clone(),
                                ModelPricing {
                                    prompt: 0.0,
                                    completion: 0.0,
                                },
                            );
                        }
                        Ok(default_pricing)
                    }
                }
            }
            Err(e) => {
                warn!("Failed to fetch model pricing: {}", e);
                // Return default zero pricing
                let mut default_pricing = HashMap::new();
                for model_id in model_ids {
                    default_pricing.insert(
                        model_id.clone(),
                        ModelPricing {
                            prompt: 0.0,
                            completion: 0.0,
                        },
                    );
                }
                Ok(default_pricing)
            }
        }
    }
}

#[derive(serde::Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
}

#[derive(serde::Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(serde::Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
    usage: ChatUsage,
}

#[derive(serde::Deserialize)]
struct ChatChoice {
    message: ChatMessage,
}

#[derive(serde::Deserialize)]
struct ChatMessage {
    content: String,
}

#[derive(serde::Deserialize)]
struct ChatUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
}

#[derive(serde::Deserialize)]
struct ModelsListResponse {
    data: Vec<OpenRouterModel>,
}

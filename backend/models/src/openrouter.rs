use crate::types::OpenRouterModel;
use reqwest::Client;
use std::time::Duration;
use tracing::{error, info};

#[derive(Debug, Clone)]
pub struct OpenRouterClient {
    http: Client,
    api_key: String,
    base_url: String,
}

#[derive(Debug)]
pub enum OpenRouterError {
    Timeout,
    Upstream,
    ParseError,
}

impl OpenRouterClient {
    pub fn new(api_key: String) -> Self {
        let http = Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            http,
            api_key,
            base_url: "https://openrouter.ai/api/v1".to_string(),
        }
    }

    pub async fn fetch_models(&self) -> Result<Vec<OpenRouterModel>, OpenRouterError> {
        let url = format!("{}/models", self.base_url);
        info!("Fetching models from OpenRouter: {}", url);

        let response = match self
            .http
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .send()
            .await
        {
            Ok(r) => r,
            Err(e) => {
                if e.is_timeout() {
                    error!("OpenRouter API timeout");
                    return Err(OpenRouterError::Timeout);
                }
                error!("OpenRouter API error: {}", e);
                return Err(OpenRouterError::Upstream);
            }
        };

        let status = response.status();
        if !status.is_success() {
            error!("OpenRouter API returned status {}", status);
            return Err(OpenRouterError::Upstream);
        }

        match response.json::<ModelsListResponse>().await {
            Ok(data) => {
                info!("Successfully fetched {} models", data.data.len());
                Ok(data.data)
            }
            Err(e) => {
                error!("Failed to parse OpenRouter response: {}", e);
                Err(OpenRouterError::ParseError)
            }
        }
    }
}

#[derive(Debug, serde::Deserialize)]
struct ModelsListResponse {
    data: Vec<OpenRouterModel>,
}

use crate::types::OpenRouterModel;
use crate::openrouter::{OpenRouterClient, OpenRouterError};
use std::sync::OnceLock;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, info};

static CACHE: OnceLock<RwLock<ModelCache>> = OnceLock::new();

#[derive(Clone)]
pub struct ModelCache {
    models: Vec<OpenRouterModel>,
    fetched_at: Option<Instant>,
    ttl: Duration,
}

impl ModelCache {
    pub fn new() -> Self {
        Self {
            models: Vec::new(),
            fetched_at: None,
            ttl: Duration::from_secs(300), // 5 minutes
        }
    }

    fn is_fresh(&self) -> bool {
        match self.fetched_at {
            None => false,
            Some(fetched) => fetched.elapsed() < self.ttl,
        }
    }

    fn refresh(&mut self, models: Vec<OpenRouterModel>) {
        self.models = models;
        self.fetched_at = Some(Instant::now());
        info!("Cache refreshed with {} models", self.models.len());
    }

    fn models(&self) -> Vec<OpenRouterModel> {
        self.models.clone()
    }
}

pub async fn get_models(client: &OpenRouterClient) -> Result<Vec<OpenRouterModel>, OpenRouterError> {
    let cache = CACHE.get_or_init(|| RwLock::new(ModelCache::new()));

    {
        let read = cache.read().await;
        if read.is_fresh() {
            debug!("Cache hit: serving {} models", read.models().len());
            return Ok(read.models());
        }
    }

    // Cache miss or stale: acquire write lock for update
    let mut write = cache.write().await;

    // Double-check after acquiring write lock
    if write.is_fresh() {
        debug!("Another task refreshed cache, serving {} models", write.models().len());
        return Ok(write.models());
    }

    info!("Cache miss or stale, fetching from OpenRouter");
    match client.fetch_models().await {
        Ok(models) => {
            write.refresh(models.clone());
            Ok(models)
        }
        Err(e) => {
            // If we have stale data, serve it
            if !write.models.is_empty() {
                debug!("Serving stale cache due to fetch error");
                Ok(write.models())
            } else {
                Err(e)
            }
        }
    }
}

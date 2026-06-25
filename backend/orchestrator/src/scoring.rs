use crate::types::{InternalModelResult, InternalJudgeResult, ModelRanking, ModelPricing};
use std::collections::{HashMap, HashSet};
use tracing::debug;

pub fn compute_rankings(
    results: &[InternalModelResult],
    judge_results: &[InternalJudgeResult],
    _pricing: &HashMap<String, ModelPricing>,
) -> Vec<ModelRanking> {
    let model_ids: HashSet<&str> = results.iter().map(|r| r.model_id.as_str()).collect();

    let mut rankings: Vec<ModelRanking> = model_ids
        .iter()
        .map(|model_id| {
            let model_results: Vec<_> = results
                .iter()
                .filter(|r| r.model_id.as_str() == *model_id)
                .collect();

            let model_judges: Vec<_> = judge_results
                .iter()
                .filter(|j| j.model_id.as_str() == *model_id)
                .collect();

            let avg_quality = if model_judges.is_empty() {
                5.0
            } else {
                let total: f64 = model_judges
                    .iter()
                    .flat_map(|j| j.scores.values())
                    .map(|&v| v as f64)
                    .sum();
                let count = model_judges
                    .iter()
                    .flat_map(|j| j.scores.values())
                    .count();

                if count > 0 {
                    total / count as f64
                } else {
                    5.0
                }
            };

            let avg_latency_ms = if model_results.is_empty() {
                0.0
            } else {
                model_results
                    .iter()
                    .map(|r| r.latency_ms as f64)
                    .sum::<f64>()
                    / model_results.len() as f64
            };

            let total_cost_usd: f64 = model_results.iter().map(|r| r.cost_usd).sum();

            let total_tokens: u64 = model_results
                .iter()
                .map(|r| (r.tokens_in + r.tokens_out) as u64)
                .sum();

            let cost_per_1k_tokens = if total_tokens > 0 {
                total_cost_usd / (total_tokens as f64 / 1000.0)
            } else {
                0.0
            };

            // Confidence: ratio of non-fallback judge results to expected
            let non_fallback_count = model_judges
                .iter()
                .filter(|j| !j.is_fallback)
                .count() as f64;
            let confidence = if model_judges.is_empty() {
                0.0
            } else {
                non_fallback_count / model_judges.len() as f64
            };

            ModelRanking {
                model_id: model_id.to_string(),
                avg_quality,
                avg_latency_ms,
                total_cost_usd,
                cost_per_1k_tokens,
                composite_score: 0.0, // Computed in normalization
                confidence,
            }
        })
        .collect();

    normalize_and_score(&mut rankings);

    rankings.sort_by(|a, b| {
        b.composite_score
            .partial_cmp(&a.composite_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    rankings
}

fn normalize_and_score(rankings: &mut [ModelRanking]) {
    if rankings.is_empty() {
        return;
    }

    let max_quality = rankings
        .iter()
        .map(|r| r.avg_quality)
        .fold(f64::MIN, f64::max);
    let min_quality = rankings
        .iter()
        .map(|r| r.avg_quality)
        .fold(f64::MAX, f64::min);

    let max_latency = rankings
        .iter()
        .map(|r| r.avg_latency_ms)
        .fold(f64::MIN, f64::max);
    let min_latency = rankings
        .iter()
        .map(|r| r.avg_latency_ms)
        .fold(f64::MAX, f64::min);

    let max_cost = rankings
        .iter()
        .map(|r| r.cost_per_1k_tokens)
        .fold(f64::MIN, f64::max);
    let min_cost = rankings
        .iter()
        .map(|r| r.cost_per_1k_tokens)
        .fold(f64::MAX, f64::min);

    for r in rankings.iter_mut() {
        let norm_quality = safe_normalize(r.avg_quality, min_quality, max_quality);
        // Lower is better for latency and cost, so invert
        let norm_speed = 1.0 - safe_normalize(r.avg_latency_ms, min_latency, max_latency);
        let norm_cost_eff = 1.0 - safe_normalize(r.cost_per_1k_tokens, min_cost, max_cost);

        r.composite_score = (0.60 * norm_quality) + (0.25 * norm_cost_eff) + (0.15 * norm_speed);

        debug!(
            "Ranked {}: quality={:.2} speed={:.2} cost_eff={:.2} composite={:.2}",
            r.model_id, norm_quality, norm_speed, norm_cost_eff, r.composite_score
        );
    }
}

fn safe_normalize(val: f64, min: f64, max: f64) -> f64 {
    if (max - min).abs() < f64::EPSILON {
        0.5
    } else {
        (val - min) / (max - min)
    }
}

use crate::types::{ModelRanking, RoutingPolicy, TestCase};
use std::collections::HashSet;

pub fn recommend_routing(
    rankings: &[ModelRanking],
    test_cases: &[TestCase],
) -> RoutingPolicy {
    if rankings.is_empty() {
        return RoutingPolicy {
            primary_model: "unknown".to_string(),
            primary_traffic_pct: 100,
            frontier_model: "unknown".to_string(),
            frontier_traffic_pct: 0,
            estimated_savings_pct: 0,
            difficulty_threshold: Vec::new(),
            incomplete_models: Vec::new(),
            reasoning: "No models to rank".to_string(),
        };
    }

    let frontier = &rankings[0]; // Best composite score

    // Find value model: highest quality >= 85% of frontier, but lowest cost
    let value = rankings
        .iter()
        .filter(|r| r.avg_quality >= frontier.avg_quality * 0.85)
        .min_by(|a, b| {
            a.cost_per_1k_tokens
                .partial_cmp(&b.cost_per_1k_tokens)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .unwrap_or(frontier);

    // Classify difficulty
    let difficulty_signals = classify_difficulty(test_cases);
    let hard_pct = estimate_hard_traffic_pct(&difficulty_signals, test_cases);

    // Find incomplete models (confidence < 0.5)
    let incomplete_models: Vec<String> = rankings
        .iter()
        .filter(|r| r.confidence < 0.5)
        .map(|r| r.model_id.clone())
        .collect();

    if frontier.model_id == value.model_id {
        // No routing benefit
        let reasoning = format!(
            "Single best model: {}. Quality: {:.1}/10, Cost: ${:.4}/1k tokens, \
             Confidence: {:.0}%.",
            frontier.model_id,
            frontier.avg_quality,
            frontier.cost_per_1k_tokens,
            frontier.confidence * 100.0
        );

        let reasoning_with_warning = if !incomplete_models.is_empty() {
            format!(
                "{}  WARNING: Models {:?} have incomplete judge data (< 50% confidence) — consider rerunning.",
                reasoning, incomplete_models
            )
        } else {
            reasoning
        };

        return RoutingPolicy {
            primary_model: frontier.model_id.clone(),
            primary_traffic_pct: 100,
            frontier_model: frontier.model_id.clone(),
            frontier_traffic_pct: 0,
            estimated_savings_pct: 0,
            difficulty_threshold: difficulty_signals,
            incomplete_models,
            reasoning: reasoning_with_warning,
        };
    }

    // Calculate savings
    let frontier_cost = frontier.cost_per_1k_tokens;
    let value_cost = value.cost_per_1k_tokens;
    let blended_cost = (hard_pct * frontier_cost) + ((1.0 - hard_pct) * value_cost);
    let savings_pct = if frontier_cost > 0.0 {
        (((frontier_cost - blended_cost) / frontier_cost) * 100.0).round()
    } else {
        0.0
    } as u32;

    let primary_pct = ((1.0 - hard_pct) * 100.0).round() as u32;
    let frontier_pct = (hard_pct * 100.0).round() as u32;

    let signals_str = difficulty_signals
        .iter()
        .map(|s| s.as_str())
        .collect::<Vec<_>>()
        .join(", ");

    let base_reasoning = format!(
        "{} scored within 15% of {} on simple prompts at {:.2}x lower cost. \
         Route hard prompts ({}) to {} for quality, everything else to {} for savings. \
         Estimated savings: {}%.",
        value.model_id, frontier.model_id,
        frontier_cost / value_cost.max(0.0001),
        signals_str,
        frontier.model_id, value.model_id,
        savings_pct
    );

    let reasoning_with_warning = if !incomplete_models.is_empty() {
        format!(
            "{}  WARNING: Models {:?} have incomplete judge data (< 50% confidence) — consider rerunning.",
            base_reasoning, incomplete_models
        )
    } else {
        base_reasoning
    };

    RoutingPolicy {
        primary_model: value.model_id.clone(),
        primary_traffic_pct: primary_pct,
        frontier_model: frontier.model_id.clone(),
        frontier_traffic_pct: frontier_pct,
        estimated_savings_pct: savings_pct,
        difficulty_threshold: difficulty_signals,
        incomplete_models,
        reasoning: reasoning_with_warning,
    }
}

pub fn classify_difficulty(test_cases: &[TestCase]) -> Vec<String> {
    let mut signals: HashSet<String> = HashSet::new();

    for tc in test_cases {
        let text = format!(
            "{} {}",
            tc.input,
            tc.expected_output.as_deref().unwrap_or("")
        );
        let lower = text.to_lowercase();

        // Token count heuristic (1 token ≈ 4 chars, threshold 4000 chars = ~1000 tokens)
        if text.len() > 4000 {
            signals.insert("token_count".to_string());
        }

        // Code markers
        if lower.contains("```")
            || lower.contains("def ")
            || lower.contains("function ")
            || lower.contains("class ")
            || lower.contains("impl ")
            || lower.contains("fn ")
        {
            signals.insert("code_markers".to_string());
        }

        // Math markers
        if lower.contains("calculate")
            || lower.contains("prove")
            || lower.contains("equation")
            || lower.contains("∑")
            || lower.contains("∫")
            || text.contains("\\frac")
        {
            signals.insert("math_markers".to_string());
        }

        // Reasoning markers
        if lower.contains("step by step")
            || lower.contains("analyze")
            || lower.contains("compare")
            || lower.contains("evaluate")
            || lower.contains("explain why")
        {
            signals.insert("reasoning_markers".to_string());
        }

        // Multi-constraint
        let constraint_count = lower.matches("must ").count()
            + lower.matches("should ").count()
            + lower.matches("ensure ").count()
            + lower.matches("make sure").count();
        if constraint_count > 3 {
            signals.insert("multi_constraint".to_string());
        }
    }

    let mut result: Vec<String> = signals.into_iter().collect();
    result.sort();
    result
}

fn estimate_hard_traffic_pct(signals: &[String], test_cases: &[TestCase]) -> f64 {
    if signals.is_empty() {
        return 0.0;
    }

    let hard_count = test_cases
        .iter()
        .filter(|tc| has_any_signal(tc, signals))
        .count();

    hard_count as f64 / test_cases.len() as f64
}

fn has_any_signal(tc: &TestCase, signals: &[String]) -> bool {
    let text = format!(
        "{} {}",
        tc.input,
        tc.expected_output.as_deref().unwrap_or("")
    );
    let lower = text.to_lowercase();

    for signal in signals {
        match signal.as_str() {
            "token_count" => {
                if text.len() > 4000 {
                    return true;
                }
            }
            "code_markers" => {
                if lower.contains("```")
                    || lower.contains("def ")
                    || lower.contains("function ")
                    || lower.contains("class ")
                    || lower.contains("impl ")
                    || lower.contains("fn ")
                {
                    return true;
                }
            }
            "math_markers" => {
                if lower.contains("calculate")
                    || lower.contains("prove")
                    || lower.contains("equation")
                    || lower.contains("∑")
                    || lower.contains("∫")
                    || text.contains("\\frac")
                {
                    return true;
                }
            }
            "reasoning_markers" => {
                if lower.contains("step by step")
                    || lower.contains("analyze")
                    || lower.contains("compare")
                    || lower.contains("evaluate")
                    || lower.contains("explain why")
                {
                    return true;
                }
            }
            "multi_constraint" => {
                let constraint_count = lower.matches("must ").count()
                    + lower.matches("should ").count()
                    + lower.matches("ensure ").count()
                    + lower.matches("make sure").count();
                if constraint_count > 3 {
                    return true;
                }
            }
            _ => {}
        }
    }

    false
}

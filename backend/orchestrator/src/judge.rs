use crate::types::JudgeScores;
use crate::openrouter::OpenRouterClient;
use std::collections::HashMap;
use regex::Regex;
use tracing::{warn, debug};

const JUDGE_SYSTEM_PROMPT: &str = r#"You are an expert evaluator assessing LLM responses.
Score the response on each criterion using a 1-10 scale.
1 = completely fails, 5 = adequate, 10 = exceptional.

You MUST respond with ONLY valid JSON, no other text.
Format: {"scores": {"criterion_name": N, ...}, "reasoning": "one sentence"}"#;

pub fn build_judge_user_prompt(
    system_prompt: &str,
    test_input: &str,
    expected_output: Option<&str>,
    model_response: &str,
    criteria: &[String],
) -> String {
    let criteria_list = criteria
        .iter()
        .map(|c| format!("- {} (1-10)", c))
        .collect::<Vec<_>>()
        .join("\n");

    let expected = expected_output
        .map(|e| format!("\n\n## Expected Output\n{}", e))
        .unwrap_or_default();

    format!(
        "## Task System Prompt\n{}\n\n\
         ## User Input\n{}{}\n\n\
         ## Model Response\n{}\n\n\
         ## Criteria to Score\n{}",
        system_prompt, test_input, expected, model_response, criteria_list
    )
}

pub async fn judge_response(
    client: &OpenRouterClient,
    judge_model: &str,
    system_prompt: &str,
    test_input: &str,
    expected_output: Option<&str>,
    model_response: &str,
    criteria: &[String],
) -> Result<JudgeScores, String> {
    let user_prompt = build_judge_user_prompt(
        system_prompt,
        test_input,
        expected_output,
        model_response,
        criteria,
    );

    let resp = client
        .chat_completion(judge_model, JUDGE_SYSTEM_PROMPT, &user_prompt)
        .await?;

    parse_judge_response(&resp.content, criteria)
}

pub fn parse_judge_response(
    content: &str,
    criteria: &[String],
) -> Result<JudgeScores, String> {
    // Strategy 1: Direct JSON parse
    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(result) = try_extract_scores(&parsed, criteria) {
            return Ok(result);
        }
    }

    // Strategy 2: Extract JSON from markdown code block
    if let Some(json_str) = extract_json_from_markdown(content) {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&json_str) {
            if let Some(result) = try_extract_scores(&parsed, criteria) {
                return Ok(result);
            }
        }
    }

    // Strategy 3: Regex pattern matching
    if let Some(result) = extract_json_with_regex(content, criteria) {
        return Ok(result);
    }

    // All parsing failed: use fallback
    warn!("Judge response unparseable: {}", content);
    let mut default_scores = HashMap::new();
    for criterion in criteria {
        default_scores.insert(criterion.clone(), 5u32);
    }

    Ok(JudgeScores {
        scores: default_scores,
        reasoning: "Parse failed, assigned neutral scores".to_string(),
        is_fallback: true,
    })
}

fn try_extract_scores(
    parsed: &serde_json::Value,
    criteria: &[String],
) -> Option<JudgeScores> {
    let scores_obj = parsed.get("scores")?.as_object()?;
    let reasoning = parsed
        .get("reasoning")
        .and_then(|v| v.as_str())
        .unwrap_or("No reasoning provided")
        .to_string();

    let mut scores = HashMap::new();

    for criterion in criteria {
        let score = scores_obj
            .get(criterion)
            .and_then(|v| v.as_u64())
            .unwrap_or(5)
            .min(10)
            .max(1) as u32;

        scores.insert(criterion.clone(), score);
    }

    // Also accept scores that are in the JSON even if not in criteria
    for (key, value) in scores_obj.iter() {
        if !scores.contains_key(key) {
            if let Some(score_val) = value.as_u64() {
                scores.insert(key.clone(), (score_val.min(10).max(1)) as u32);
            }
        }
    }

    // If no scores extracted, fail
    if scores.is_empty() {
        return None;
    }

    Some(JudgeScores {
        scores,
        reasoning,
        is_fallback: false,
    })
}

fn extract_json_from_markdown(content: &str) -> Option<String> {
    // Look for ```json ... ``` or ``` ... ```
    if let Some(start_idx) = content.find("```") {
        let after_fence = &content[start_idx + 3..];
        // Skip optional "json" or similar
        let start_content = if after_fence.starts_with("json") {
            after_fence[4..].trim_start()
        } else {
            after_fence.trim_start()
        };

        if let Some(end_idx) = start_content.find("```") {
            return Some(start_content[..end_idx].trim().to_string());
        }
    }

    None
}

fn extract_json_with_regex(content: &str, criteria: &[String]) -> Option<JudgeScores> {
    // Try to find a JSON object pattern
    let pattern = r#"\{[^}]*"scores"[^}]*\}"#;
    if let Ok(re) = Regex::new(pattern) {
        if let Some(mat) = re.find(content) {
            let json_str = mat.as_str();
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(json_str) {
                if let Some(result) = try_extract_scores(&parsed, criteria) {
                    debug!("Extracted scores from regex match");
                    return Some(result);
                }
            }
        }
    }

    None
}

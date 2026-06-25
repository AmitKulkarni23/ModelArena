use crate::types::BenchmarkRequest;

pub fn validate_benchmark_request(req: &BenchmarkRequest) -> Result<(), String> {
    // Validate system_prompt
    if req.system_prompt.is_empty() || req.system_prompt.len() > 10_000 {
        return Err("system_prompt must be 1-10,000 chars".to_string());
    }

    // Validate test_cases
    if req.test_cases.is_empty() || req.test_cases.len() > 50 {
        return Err("test_cases must have 1-50 items".to_string());
    }

    for (i, tc) in req.test_cases.iter().enumerate() {
        if tc.input.is_empty() || tc.input.len() > 10_000 {
            return Err(format!(
                "test_cases[{}].input must be 1-10,000 chars",
                i
            ));
        }

        if let Some(ref expected) = tc.expected_output {
            if expected.len() > 10_000 {
                return Err(format!(
                    "test_cases[{}].expected_output max 10,000 chars",
                    i
                ));
            }
        }

        if let Some(ref label) = tc.label {
            if label.len() > 100 {
                return Err(format!("test_cases[{}].label max 100 chars", i));
            }
        }
    }

    // Validate models
    if req.models.len() < 3 || req.models.len() > 10 {
        return Err("models must have 3-10 items".to_string());
    }

    for model in &req.models {
        if !model.contains('/') {
            return Err(format!("invalid model ID format: {}", model));
        }
    }

    // Validate judge_models if present
    if let Some(ref judges) = req.judge_models {
        if judges.is_empty() || judges.len() > 3 {
            return Err("judge_models must have 1-3 items".to_string());
        }

        for judge in judges {
            if !judge.contains('/') {
                return Err(format!("invalid judge model ID format: {}", judge));
            }
        }
    }

    // Validate rubric_criteria if present
    if let Some(ref criteria) = req.rubric_criteria {
        if criteria.is_empty() || criteria.len() > 5 {
            return Err("rubric_criteria must have 1-5 items".to_string());
        }

        for crit in criteria {
            if crit.is_empty() || crit.len() > 100 {
                return Err("each criterion must be 1-100 chars".to_string());
            }
        }
    }

    Ok(())
}

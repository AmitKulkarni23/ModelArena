import { useMemo } from "react";
import { ModelSummary } from "../types/models";
import { TestCase } from "../types/benchmark";

export function useCostEstimate(
  selectedModels: ModelSummary[],
  testCases: TestCase[],
  systemPrompt: string,
): number {
  return useMemo(() => {
    const systemTokens = Math.ceil(systemPrompt.length / 4);
    const estimatedOutputTokens = 500;

    return selectedModels.reduce((total, model) => {
      const modelCost = testCases.reduce((tc_total, tc) => {
        const inputTokens = systemTokens + Math.ceil(tc.input.length / 4);
        const expectedTokens = tc.expected_output
          ? Math.ceil(tc.expected_output.length / 4)
          : 0;
        const promptCost =
          (inputTokens + expectedTokens) *
          (model.pricing.prompt_per_million / 1_000_000);
        const completionCost =
          estimatedOutputTokens *
          (model.pricing.completion_per_million / 1_000_000);
        return tc_total + promptCost + completionCost;
      }, 0);
      return total + modelCost;
    }, 0);
  }, [selectedModels, testCases, systemPrompt]);
}

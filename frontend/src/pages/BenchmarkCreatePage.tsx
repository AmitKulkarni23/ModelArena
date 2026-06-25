import React, { useState, useMemo } from "react";
import { keyframes } from "@emotion/react";
import {
  Container,
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Stack,
} from "@mui/material";
import { PromptConfigStep } from "../components/PromptConfigStep";
import { ModelSelectionStep } from "../components/ModelSelectionStep";
import { ReviewStep } from "../components/ReviewStep";
import { TestCase, BenchmarkConfig } from "../types/benchmark";
import { useBenchmark } from "../hooks/useBenchmark";
import { useModels } from "../hooks/useModels";

const stepIn = keyframes`
  from { opacity: 0; transform: translateX(8px); }
  to   { opacity: 1; transform: translateX(0); }
`;

const STEPS = ["Configure Prompt", "Select Models", "Review & Run"];

export function BenchmarkCreatePage() {
  const [activeStep, setActiveStep] = useState(0);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  const [systemPromptError, setSystemPromptError] = useState("");
  const [testCasesError, setTestCasesError] = useState("");
  const [modelError, setModelError] = useState("");

  const { state: benchmarkState, startBenchmark } = useBenchmark();
  const { models } = useModels();

  const selectedModelIdSet = useMemo(() => new Set(selectedModelIds), [selectedModelIds]);
  const selectedModels = useMemo(
    () => models.filter((m) => selectedModelIdSet.has(m.id)),
    [models, selectedModelIdSet],
  );

  const clearErrors = () => {
    setSystemPromptError("");
    setTestCasesError("");
    setModelError("");
  };

  const handleNext = () => {
    clearErrors();

    if (activeStep === 0) {
      let valid = true;
      if (!systemPrompt.trim()) {
        setSystemPromptError("System prompt is required.");
        valid = false;
      }
      if (testCases.length === 0) {
        setTestCasesError("Add at least one test case.");
        valid = false;
      }
      if (!valid) return;
    }

    if (activeStep === 1) {
      if (selectedModelIds.length === 0) {
        setModelError("Select at least one model to benchmark.");
        return;
      }
    }

    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    clearErrors();
    setActiveStep((prev) => prev - 1);
  };

  const handleToggleModel = (modelId: string) => {
    setModelError("");
    setSelectedModelIds((prev) =>
      prev.includes(modelId)
        ? prev.filter((id) => id !== modelId)
        : prev.length < 10
          ? [...prev, modelId]
          : prev,
    );
  };

  const handleRunBenchmark = () => {
    const config: BenchmarkConfig = {
      system_prompt: systemPrompt,
      test_cases: testCases,
      model_ids: selectedModelIds,
    };
    startBenchmark(config);
    window.location.hash = "/benchmark/run";
  };

  if (benchmarkState.phase === "running" || benchmarkState.phase === "complete") {
    window.location.hash = "/benchmark/run";
    return null;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stepper activeStep={activeStep}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box
          key={activeStep}
          sx={{ minHeight: 400, animation: `${stepIn} 0.2s cubic-bezier(0.25, 1, 0.5, 1) both` }}
        >
          {activeStep === 0 && (
            <PromptConfigStep
              systemPrompt={systemPrompt}
              onSystemPromptChange={(v) => { setSystemPromptError(""); setSystemPrompt(v); }}
              testCases={testCases}
              onTestCasesChange={(v) => { setTestCasesError(""); setTestCases(v); }}
              systemPromptError={systemPromptError}
              testCasesError={testCasesError}
            />
          )}

          {activeStep === 1 && (
            <ModelSelectionStep
              selectedModelIds={selectedModelIds}
              onToggleModel={handleToggleModel}
              error={modelError}
            />
          )}

          {activeStep === 2 && (
            <ReviewStep
              config={{
                system_prompt: systemPrompt,
                test_cases: testCases,
                model_ids: selectedModelIds,
              }}
              selectedModels={selectedModels}
              onRunBenchmark={handleRunBenchmark}
            />
          )}
        </Box>

        <Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
          <Button onClick={handleBack} disabled={activeStep === 0}>
            Back
          </Button>
          {activeStep < 2 && (
            <Button variant="contained" onClick={handleNext}>
              Next
            </Button>
          )}
        </Stack>
      </Stack>
    </Container>
  );
}

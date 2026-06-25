import React, { useState } from "react";
import {
  Container,
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Stack,
  Alert,
} from "@mui/material";
import { PromptConfigStep } from "../components/PromptConfigStep";
import { ModelSelectionStep } from "../components/ModelSelectionStep";
import { ReviewStep } from "../components/ReviewStep";
import { TestCase, BenchmarkConfig } from "../types/benchmark";
import { useBenchmark } from "../hooks/useBenchmark";
import { useModels } from "../hooks/useModels";

const steps = ["Configure Prompt", "Select Models", "Review & Run"];

export function BenchmarkCreatePage() {
  const [activeStep, setActiveStep] = useState(0);
  const [systemPrompt, setSystemPrompt] = useState("");
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  const { state: benchmarkState, startBenchmark } = useBenchmark();
  const { models } = useModels();

  const selectedModels = models.filter((m) =>
    selectedModelIds.includes(m.id),
  );

  const handleNext = () => {
    if (activeStep === 0) {
      if (!systemPrompt.trim()) {
        alert("System prompt is required");
        return;
      }
      if (testCases.length === 0) {
        alert("Add at least one test case");
        return;
      }
    } else if (activeStep === 1) {
      if (selectedModelIds.length === 0) {
        alert("Select at least one model");
        return;
      }
      if (selectedModelIds.length > 10) {
        alert("Maximum 10 models allowed");
        return;
      }
    }
    setActiveStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleToggleModel = (modelId: string) => {
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
    window.location.hash = "/#/benchmark/run";
  };

  if (benchmarkState.phase === "running" || benchmarkState.phase === "complete") {
    window.location.hash = "/#/benchmark/run";
    return null;
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Stepper activeStep={activeStep}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 400 }}>
          {activeStep === 0 && (
            <PromptConfigStep
              systemPrompt={systemPrompt}
              onSystemPromptChange={setSystemPrompt}
              testCases={testCases}
              onTestCasesChange={setTestCases}
            />
          )}

          {activeStep === 1 && (
            <ModelSelectionStep
              selectedModelIds={selectedModelIds}
              onToggleModel={handleToggleModel}
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
          <Button
            onClick={handleBack}
            disabled={activeStep === 0}
          >
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

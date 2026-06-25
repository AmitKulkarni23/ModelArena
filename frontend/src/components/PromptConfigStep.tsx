import React from "react";
import { Stack, TextField, Typography, Box, Alert } from "@mui/material";
import { TestCaseList } from "./TestCaseList";
import { TestCase } from "../types/benchmark";

interface PromptConfigStepProps {
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  testCases: TestCase[];
  onTestCasesChange: (cases: TestCase[]) => void;
  systemPromptError?: string;
  testCasesError?: string;
}

export function PromptConfigStep({
  systemPrompt,
  onSystemPromptChange,
  testCases,
  onTestCasesChange,
  systemPromptError,
  testCasesError,
}: PromptConfigStepProps) {
  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          System Prompt
        </Typography>
        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder="Enter the system prompt for the benchmark..."
          value={systemPrompt}
          onChange={(e) => onSystemPromptChange(e.target.value)}
          error={!!systemPromptError}
          helperText={systemPromptError}
        />
      </Box>

      <Box>
        <TestCaseList testCases={testCases} onUpdate={onTestCasesChange} />
        {testCasesError && (
          <Alert severity="error" sx={{ mt: 1.5 }}>
            {testCasesError}
          </Alert>
        )}
      </Box>
    </Stack>
  );
}

import React from "react";
import { Stack, TextField, Typography, Box } from "@mui/material";
import { TestCaseList } from "./TestCaseList";
import { TestCase } from "../types/benchmark";

interface PromptConfigStepProps {
  systemPrompt: string;
  onSystemPromptChange: (prompt: string) => void;
  testCases: TestCase[];
  onTestCasesChange: (cases: TestCase[]) => void;
}

export function PromptConfigStep({
  systemPrompt,
  onSystemPromptChange,
  testCases,
  onTestCasesChange,
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
        />
      </Box>

      <TestCaseList testCases={testCases} onUpdate={onTestCasesChange} />
    </Stack>
  );
}

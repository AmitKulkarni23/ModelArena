import React from "react";
import { Stack, Button, Typography, Box } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { TestCaseCard } from "./TestCaseCard";
import { TestCase } from "../types/benchmark";

interface TestCaseListProps {
  testCases: TestCase[];
  onUpdate: (updated: TestCase[]) => void;
}

export function TestCaseList({ testCases, onUpdate }: TestCaseListProps) {
  const handleUpdateCase = (index: number, updated: TestCase) => {
    const newCases = [...testCases];
    newCases[index] = updated;
    onUpdate(newCases);
  };

  const handleRemoveCase = (index: number) => {
    onUpdate(testCases.filter((_, i) => i !== index));
  };

  const handleAddCase = () => {
    onUpdate([...testCases, { input: "", expected_output: "", label: "" }]);
  };

  return (
    <Stack spacing={2}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Test Cases ({testCases.length})
        </Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddCase}
          size="small"
        >
          Add Case
        </Button>
      </Box>

      {testCases.length === 0 && (
        <Typography variant="body2" color="textSecondary" sx={{ py: 2 }}>
          No test cases yet. Click "Add Case" to get started.
        </Typography>
      )}

      {testCases.map((tc, idx) => (
        <TestCaseCard
          key={idx}
          testCase={tc}
          index={idx}
          onUpdate={handleUpdateCase}
          onRemove={handleRemoveCase}
        />
      ))}
    </Stack>
  );
}

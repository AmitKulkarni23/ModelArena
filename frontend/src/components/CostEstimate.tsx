import React from "react";
import { Card, CardContent, Typography, Box, Stack, Alert } from "@mui/material";
import { useCostEstimate } from "../hooks/useCostEstimate";
import { ModelSummary } from "../types/models";
import { TestCase } from "../types/benchmark";

interface CostEstimateProps {
  selectedModels: ModelSummary[];
  testCases: TestCase[];
  systemPrompt: string;
}

export function CostEstimate({
  selectedModels,
  testCases,
  systemPrompt,
}: CostEstimateProps) {
  const totalCost = useCostEstimate(selectedModels, testCases, systemPrompt);

  const perModelCost = selectedModels.length > 0 ? totalCost / selectedModels.length : 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Cost Estimate
        </Typography>

        <Stack spacing={2}>
          <Box>
            <Typography variant="body2" color="textSecondary">
              Total Cost
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: "primary.main" }}>
              ${totalCost.toFixed(4)}
            </Typography>
          </Box>

          {selectedModels.length > 0 && (
            <Box>
              <Typography variant="body2" color="textSecondary">
                Per-Model Cost
              </Typography>
              <Typography variant="body1">
                ${perModelCost.toFixed(4)} × {selectedModels.length} models
              </Typography>
            </Box>
          )}

          <Alert severity="info" sx={{ fontSize: "0.875rem" }}>
            Judge costs: $0 (free tier)
          </Alert>
        </Stack>
      </CardContent>
    </Card>
  );
}

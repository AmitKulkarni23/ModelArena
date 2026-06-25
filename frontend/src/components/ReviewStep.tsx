import React from "react";
import {
  Stack,
  Card,
  CardContent,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Chip,
  Button,
  Alert,
} from "@mui/material";
import { CostEstimate } from "./CostEstimate";
import { TestCase, BenchmarkConfig } from "../types/benchmark";
import { ModelSummary } from "../types/models";

interface ReviewStepProps {
  config: BenchmarkConfig;
  selectedModels: ModelSummary[];
  onRunBenchmark: () => void;
  isRunning?: boolean;
}

export function ReviewStep({
  config,
  selectedModels,
  onRunBenchmark,
  isRunning = false,
}: ReviewStepProps) {
  return (
    <Stack spacing={3}>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Configuration Summary
          </Typography>

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                System Prompt
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  p: 1.5,
                  backgroundColor: "action.hover",
                  borderRadius: 1,
                  maxHeight: 100,
                  overflow: "auto",
                }}
              >
                {config.system_prompt.slice(0, 200)}
                {config.system_prompt.length > 200 ? "..." : ""}
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Test Cases ({config.test_cases.length})
              </Typography>
              <List sx={{ p: 0 }}>
                {config.test_cases.map((tc, idx) => (
                  <ListItem key={idx} sx={{ pl: 0, py: 0.5 }}>
                    <ListItemText
                      primary={tc.label || `Case ${idx + 1}`}
                      secondary={tc.input.slice(0, 60) + (tc.input.length > 60 ? "..." : "")}
                      primaryTypographyProps={{ variant: "body2", fontWeight: 600 }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                Models ({selectedModels.length})
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {selectedModels.map((m) => (
                  <Chip key={m.id} label={m.name} size="small" />
                ))}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <CostEstimate
        selectedModels={selectedModels}
        testCases={config.test_cases}
        systemPrompt={config.system_prompt}
      />

      <Alert severity="warning" icon={<span>⚖️</span>}>
        Judged by our free-tier panel — they work for exposure, not tokens.
      </Alert>

      <Button
        variant="contained"
        size="large"
        onClick={onRunBenchmark}
        disabled={isRunning}
        fullWidth
      >
        {isRunning ? "Running..." : "Run Benchmark"}
      </Button>
    </Stack>
  );
}

import React from "react";
import {
  Box,
  LinearProgress,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
} from "@mui/material";
import CancelIcon from "@mui/icons-material/Cancel";

interface ProgressHeaderProps {
  modelTasksCompleted: number;
  modelTasksTotal: number;
  judgeTasksCompleted: number;
  judgeTasksTotal: number;
  onCancel: () => void;
}

export function ProgressHeader({
  modelTasksCompleted,
  modelTasksTotal,
  judgeTasksCompleted,
  judgeTasksTotal,
  onCancel,
}: ProgressHeaderProps) {
  const modelProgress = modelTasksTotal > 0 ? (modelTasksCompleted / modelTasksTotal) * 100 : 0;
  const judgeProgress = judgeTasksTotal > 0 ? (judgeTasksCompleted / judgeTasksTotal) * 100 : 0;

  const isJudging = modelTasksCompleted === modelTasksTotal && judgeTasksCompleted < judgeTasksTotal;
  const isAnalyzing = judgeTasksCompleted === judgeTasksTotal;

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Stack spacing={0.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Benchmark Progress
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {isAnalyzing
                  ? "Composite scores computed. Opening results..."
                  : isJudging
                    ? `LLM judge scoring ${judgeTasksCompleted + 1} of ${judgeTasksTotal} responses...`
                    : `Querying ${modelTasksTotal} model${modelTasksTotal !== 1 ? "s" : ""} via OpenRouter...`}
              </Typography>
            </Stack>
            <Button
              variant="outlined"
              size="small"
              startIcon={<CancelIcon />}
              onClick={onCancel}
              color="error"
            >
              Cancel
            </Button>
          </Box>

          <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Model Execution
              </Typography>
              <Typography variant="caption" color="textSecondary">
                {modelTasksCompleted} of {modelTasksTotal}
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={modelProgress} />
          </Box>

          {judgeTasksTotal > 0 && (
            <Box>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>
                  Judging
                </Typography>
                <Typography variant="caption" color="textSecondary">
                  {judgeTasksCompleted} of {judgeTasksTotal}
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={judgeProgress} />
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

import React, { useState } from "react";
import {
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Card,
  CardContent,
  Typography,
  Stack,
  Collapse,
  Box,
} from "@mui/material";
import { ModelSummary } from "../types/models";
import { ModelResultEvent, JudgeResultEvent } from "../types/benchmark";

interface RankingsTableProps {
  models: ModelSummary[];
  modelResults: Map<string, ModelResultEvent>;
  judgeResults: Map<string, JudgeResultEvent[]>;
  testCaseCount: number;
}

interface ModelMetrics {
  modelId: string;
  modelName: string;
  avgQuality: number;
  avgLatency: number;
  totalCost: number;
  costPer1k: number;
  compositeScore: number;
}

export function RankingsTable({
  models,
  modelResults,
  judgeResults,
  testCaseCount,
}: RankingsTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const metrics: ModelMetrics[] = models
    .map((model) => {
      let qualitySum = 0;
      let qualityCount = 0;
      let latencySum = 0;
      let latencyCount = 0;
      let costSum = 0;
      let tokenCount = 0;

      for (let tcIdx = 0; tcIdx < testCaseCount; tcIdx++) {
        const key = `${model.id}:${tcIdx}`;
        const modelResult = modelResults.get(key);

        if (modelResult) {
          latencySum += modelResult.latency_ms;
          latencyCount++;
          costSum += modelResult.cost_usd;
          tokenCount += modelResult.tokens_in + modelResult.tokens_out;
        }

        const judgeRez = judgeResults.get(key);
        if (judgeRez && judgeRez.length > 0) {
          const scores = judgeRez.map((j) => j.score);
          qualitySum += scores.reduce((a, b) => a + b, 0) / scores.length;
          qualityCount++;
        }
      }

      const avgQuality = qualityCount > 0 ? qualitySum / qualityCount : 0;
      const avgLatency = latencyCount > 0 ? latencySum / latencyCount : 0;
      const costPer1k = tokenCount > 0 ? (costSum / tokenCount) * 1000 : 0;
      const compositeScore = (avgQuality * 0.6 + (10 - Math.min(avgLatency / 1000, 10)) * 0.4);

      return {
        modelId: model.id,
        modelName: model.name,
        avgQuality,
        avgLatency,
        totalCost: costSum,
        costPer1k,
        compositeScore,
      };
    })
    .sort((a, b) => b.compositeScore - a.compositeScore);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Model Rankings
        </Typography>

        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 700 }}>Rank</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Model</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Avg Quality
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Avg Latency (ms)
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Total Cost
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  Composite Score
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.map((metric, idx) => (
                <React.Fragment key={metric.modelId}>
                  <TableRow
                    onClick={() =>
                      setExpandedRow(
                        expandedRow === metric.modelId ? null : metric.modelId,
                      )
                    }
                    sx={{
                      cursor: "pointer",
                      "&:hover": { backgroundColor: "action.hover" },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700 }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {metric.modelName}
                    </TableCell>
                    <TableCell align="right">
                      {metric.avgQuality.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      {metric.avgLatency.toFixed(0)}
                    </TableCell>
                    <TableCell align="right">
                      ${metric.totalCost.toFixed(4)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main" }}>
                      {metric.compositeScore.toFixed(2)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={6} sx={{ p: 0 }}>
                      <Collapse
                        in={expandedRow === metric.modelId}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box sx={{ p: 2, backgroundColor: "action.hover" }}>
                          <Stack spacing={1}>
                            <Typography variant="caption">
                              Cost per 1k tokens: ${metric.costPer1k.toFixed(6)}
                            </Typography>
                            <Typography variant="caption">
                              Composite Score: {metric.compositeScore.toFixed(2)} (60% quality + 40% speed)
                            </Typography>
                          </Stack>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

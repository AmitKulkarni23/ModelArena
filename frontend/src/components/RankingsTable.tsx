import React, { useState } from "react";
import { keyframes } from "@emotion/react";
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
  Tooltip,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { ModelSummary } from "../types/models";
import { ModelResultEvent, JudgeResultEvent } from "../types/benchmark";

const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const rowIn = keyframes`
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
`;

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
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Model Rankings
        </Typography>

        <TableContainer sx={{ overflowX: "auto" }}>
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
                  <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
                    <span>Composite Score</span>
                    <Tooltip title="60% quality score + 40% speed. Latency penalty capped at 10 s — anything slower scores 0 on speed." arrow>
                      <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.disabled", cursor: "help" }} />
                    </Tooltip>
                  </Stack>
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
                      animation: `${rowIn} 0.25s ease-out both`,
                      animationDelay: `${idx * 45}ms`,
                      "&:hover": { backgroundColor: "action.hover" },
                    }}
                  >
                    <TableCell sx={{ fontWeight: 700, fontFamily: MONO }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontWeight: 600, fontFamily: MONO }}>
                      {metric.modelName}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: MONO }}>
                      {metric.avgQuality.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: MONO }}>
                      {metric.avgLatency.toFixed(0)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: MONO }}>
                      ${metric.totalCost.toFixed(4)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700, color: "primary.main", fontFamily: MONO }}>
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
                            <Typography variant="caption" sx={{ fontFamily: MONO }}>
                              Cost per 1k tokens: ${metric.costPer1k.toFixed(6)}
                            </Typography>
                            <Typography variant="caption" sx={{ fontFamily: MONO }}>
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

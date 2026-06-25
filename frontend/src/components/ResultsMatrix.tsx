import React from "react";
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
  Box,
  Chip,
} from "@mui/material";
import { ModelSummary } from "../types/models";
import { ModelResultEvent, JudgeResultEvent, TestCase } from "../types/benchmark";

interface ResultsMatrixProps {
  models: ModelSummary[];
  testCases: TestCase[];
  modelResults: Map<string, ModelResultEvent>;
  judgeResults: Map<string, JudgeResultEvent[]>;
  onCellClick?: (modelId: string, testCaseIdx: number) => void;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "#16a34a";
  if (score >= 6) return "#d97706";
  if (score >= 4) return "#ea580c";
  return "#dc2626";
}

export function ResultsMatrix({
  models,
  testCases,
  modelResults,
  judgeResults,
  onCellClick,
}: ResultsMatrixProps) {
  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          Results Matrix
        </Typography>

        <TableContainer sx={{ overflowX: "auto" }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: "action.hover" }}>
                <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>
                  Model
                </TableCell>
                {testCases.map((tc, idx) => (
                  <TableCell key={idx} sx={{ fontWeight: 700, minWidth: 130 }}>
                    {tc.label || `Test ${idx + 1}`}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{model.name}</TableCell>
                  {testCases.map((_, tcIdx) => {
                    const key = `${model.id}:${tcIdx}`;
                    const modelResult = modelResults.get(key);
                    const judgeRez = judgeResults.get(key);

                    let scoreDisplay = "-";
                    let scoreColor = "inherit";

                    if (judgeRez && judgeRez.length > 0) {
                      const avg =
                        judgeRez.reduce((sum, j) => sum + j.score, 0) /
                        judgeRez.length;
                      scoreDisplay = avg.toFixed(1);
                      scoreColor = getScoreColor(avg);
                    }

                    return (
                      <TableCell
                        key={key}
                        onClick={() =>
                          modelResult && onCellClick?.(model.id, tcIdx)
                        }
                        sx={{
                          cursor: modelResult ? "pointer" : "default",
                          p: 1,
                          textAlign: "center",
                          "&:hover": modelResult
                            ? { backgroundColor: "action.hover" }
                            : {},
                        }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              backgroundColor:
                                scoreDisplay === "-" ? "action.disabled" : scoreColor,
                              color: "white",
                              fontWeight: 700,
                              fontSize: "0.875rem",
                            }}
                          >
                            {scoreDisplay}
                          </Box>
                          {modelResult && (
                            <>
                              <Chip
                                label={`${modelResult.latency_ms}ms`}
                                size="small"
                                variant="outlined"
                              />
                              <Chip
                                label={`$${modelResult.cost_usd.toFixed(4)}`}
                                size="small"
                                variant="outlined"
                              />
                            </>
                          )}
                        </Box>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
}

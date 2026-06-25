import React from "react";
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
  Box,
  Chip,
  useTheme,
} from "@mui/material";
import { Theme } from "@mui/material/styles";
import { ModelSummary } from "../types/models";

const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const scoreIn = keyframes`
  from { opacity: 0; transform: scale(0.7); }
  to   { opacity: 1; transform: scale(1); }
`;
import { ModelResultEvent, JudgeResultEvent, TestCase } from "../types/benchmark";

interface ResultsMatrixProps {
  models: ModelSummary[];
  testCases: TestCase[];
  modelResults: Map<string, ModelResultEvent>;
  judgeResults: Map<string, JudgeResultEvent[]>;
  onCellClick?: (modelId: string, testCaseIdx: number) => void;
}

function getScoreColor(score: number, theme: Theme): string {
  if (score >= 8) return theme.palette.success.main;
  if (score >= 6) return theme.palette.warning.main;
  if (score >= 4) return theme.palette.error.light ?? "#ea580c";
  return theme.palette.error.main;
}

export function ResultsMatrix({
  models,
  testCases,
  modelResults,
  judgeResults,
  onCellClick,
}: ResultsMatrixProps) {
  const theme = useTheme();
  return (
    <Card>
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
                  <TableCell sx={{ fontWeight: 600, fontFamily: MONO }}>{model.name}</TableCell>
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
                      scoreColor = getScoreColor(avg, theme);
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
                              fontFamily: MONO,
                              ...(scoreDisplay !== "-" && {
                                animation: `${scoreIn} 0.2s cubic-bezier(0.25, 1, 0.5, 1) both`,
                              }),
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
                                sx={{ fontFamily: MONO }}
                              />
                              <Chip
                                label={`$${modelResult.cost_usd.toFixed(4)}`}
                                size="small"
                                variant="outlined"
                                sx={{ fontFamily: MONO }}
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

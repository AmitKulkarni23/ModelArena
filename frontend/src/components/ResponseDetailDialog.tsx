import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableRow,
  Divider,
  Paper,
} from "@mui/material";
import { ModelResultEvent, JudgeResultEvent } from "../types/benchmark";

interface ResponseDetailDialogProps {
  open: boolean;
  onClose: () => void;
  modelResult?: ModelResultEvent;
  judgeResults?: JudgeResultEvent[];
  modelName?: string;
  testCaseInput?: string;
}

export function ResponseDetailDialog({
  open,
  onClose,
  modelResult,
  judgeResults,
  modelName,
  testCaseInput,
}: ResponseDetailDialogProps) {
  if (!modelResult) {
    return null;
  }

  const avgScore =
    judgeResults && judgeResults.length > 0
      ? judgeResults.reduce((sum, j) => sum + j.score, 0) / judgeResults.length
      : null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {modelName} - Response Details
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={3}>
          {testCaseInput && (
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Input
              </Typography>
              <Paper sx={{ p: 2, backgroundColor: "action.hover" }}>
                <Typography variant="body2">{testCaseInput}</Typography>
              </Paper>
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Model Response
            </Typography>
            <Paper sx={{ p: 2, backgroundColor: "action.hover", maxHeight: 300, overflow: "auto" }}>
              <Typography variant="body2">{modelResult.response}</Typography>
            </Paper>
          </Box>

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Performance Metrics
            </Typography>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, border: "none" }}>
                    Latency
                  </TableCell>
                  <TableCell sx={{ border: "none" }}>
                    {modelResult.latency_ms}ms
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, border: "none" }}>
                    Input Tokens
                  </TableCell>
                  <TableCell sx={{ border: "none" }}>
                    {modelResult.tokens_in}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, border: "none" }}>
                    Output Tokens
                  </TableCell>
                  <TableCell sx={{ border: "none" }}>
                    {modelResult.tokens_out}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600, border: "none" }}>
                    Cost
                  </TableCell>
                  <TableCell sx={{ border: "none" }}>
                    ${modelResult.cost_usd.toFixed(6)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>

          {judgeResults && judgeResults.length > 0 && (
            <>
              <Divider />
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Judge Evaluation
                </Typography>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                  Average Score: <strong>{avgScore?.toFixed(2)} / 10</strong>
                </Typography>

                <Stack spacing={2}>
                  {judgeResults.map((judge, idx) => (
                    <Paper key={idx} sx={{ p: 2, backgroundColor: "action.hover" }}>
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 700, display: "block", mb: 1 }}
                      >
                        Judge {idx + 1}: Score {judge.score.toFixed(1)}/10
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        {judge.reasoning}
                      </Typography>

                      {judge.criterion_scores &&
                        Object.entries(judge.criterion_scores).length > 0 && (
                          <Box sx={{ mt: 1, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              Criterion Scores:
                            </Typography>
                            {Object.entries(judge.criterion_scores).map(
                              ([criterion, score]) => (
                                <Typography
                                  key={criterion}
                                  variant="caption"
                                  display="block"
                                >
                                  {criterion}: {score}
                                </Typography>
                              ),
                            )}
                          </Box>
                        )}
                    </Paper>
                  ))}
                </Stack>
              </Box>
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

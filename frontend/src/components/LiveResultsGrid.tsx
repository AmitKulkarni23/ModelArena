import React from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  Typography,
  Alert,
  Stack,
  Collapse,
  IconButton,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ErrorIcon from "@mui/icons-material/Error";
import { ResultCell } from "./ResultCell";
import { ModelResultEvent, JudgeResultEvent, BenchmarkErrorEvent } from "../types/benchmark";

interface LiveResultsGridProps {
  modelNames: Map<string, string>;
  testCaseLabels: string[];
  modelResults: Map<string, ModelResultEvent>;
  judgeResults: Map<string, JudgeResultEvent[]>;
  errors: BenchmarkErrorEvent[];
  onCellClick?: (modelId: string, testCaseIdx: number) => void;
}

export function LiveResultsGrid({
  modelNames,
  testCaseLabels,
  modelResults,
  judgeResults,
  errors,
  onCellClick,
}: LiveResultsGridProps) {
  const [expandErrors, setExpandErrors] = React.useState(false);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
            Live Results
          </Typography>

          <TableContainer sx={{ overflowX: "auto" }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: "action.hover" }}>
                  <TableCell sx={{ fontWeight: 700, minWidth: 150 }}>
                    Model
                  </TableCell>
                  {testCaseLabels.map((label, idx) => (
                    <TableCell key={idx} sx={{ fontWeight: 700, minWidth: 150 }}>
                      {label}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {Array.from(modelNames.entries()).map(([modelId, modelName]) => (
                  <TableRow key={modelId}>
                    <TableCell sx={{ fontWeight: 600 }}>{modelName}</TableCell>
                    {testCaseLabels.map((_, tcIdx) => {
                      const key = `${modelId}:${tcIdx}`;
                      const modelResult = modelResults.get(key);
                      const judgeRez = judgeResults.get(key);
                      return (
                        <TableCell key={key} sx={{ p: 0 }}>
                          <ResultCell
                            modelResult={modelResult}
                            judgeResults={judgeRez}
                            onClickDetail={
                              onCellClick
                                ? () => onCellClick(modelId, tcIdx)
                                : undefined
                            }
                          />
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

      {errors.length > 0 && (
        <Card sx={{ backgroundColor: "error.light" }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                justifyContent: "space-between",
              }}
              onClick={() => setExpandErrors(!expandErrors)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ErrorIcon color="error" />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {errors.length} Error{errors.length !== 1 ? "s" : ""}
                </Typography>
              </Box>
              <IconButton
                size="small"
                sx={{
                  transform: expandErrors ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.3s",
                }}
              >
                <ExpandMoreIcon />
              </IconButton>
            </Box>

            <Collapse in={expandErrors}>
              <Stack spacing={1} sx={{ mt: 2 }}>
                {errors.map((err, idx) => (
                  <Alert key={idx} severity="error">
                    {err.model_id && `[${err.model_id}] `}
                    {err.message}
                  </Alert>
                ))}
              </Stack>
            </Collapse>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

import React from "react";
import { keyframes } from "@emotion/react";
import { Box, CircularProgress, Chip, Stack, Typography, Button, useTheme } from "@mui/material";
import { ModelResultEvent, JudgeResultEvent } from "../types/benchmark";

const cellIn = keyframes`
  from { opacity: 0; transform: scale(0.97); }
  to   { opacity: 1; transform: scale(1); }
`;

const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

interface ResultCellProps {
  modelResult?: ModelResultEvent;
  judgeResults?: JudgeResultEvent[];
  onClickDetail?: () => void;
}

export function ResultCell({
  modelResult,
  judgeResults,
  onClickDetail,
}: ResultCellProps) {
  const theme = useTheme();

  function getScoreColor(score: number): string {
    if (score >= 8) return theme.palette.success.main;
    if (score >= 6) return theme.palette.warning.main;
    if (score >= 4) return theme.palette.error.light ?? "#ea580c";
    return theme.palette.error.main;
  }

  if (!modelResult) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
          minHeight: 120,
        }}
      >
        <CircularProgress size={24} />
      </Box>
    );
  }

  const avgScore =
    judgeResults && judgeResults.length > 0
      ? judgeResults.reduce((sum, j) => sum + j.score, 0) / judgeResults.length
      : null;

  return (
    <Box
      onClick={onClickDetail}
      sx={{
        p: 2,
        minHeight: 120,
        border: "1px solid",
        borderColor: "divider",
        cursor: onClickDetail ? "pointer" : "default",
        transition: "background-color 0.15s ease",
        animation: `${cellIn} 0.25s cubic-bezier(0.25, 1, 0.5, 1) both`,
        "&:hover": onClickDetail ? { backgroundColor: "action.hover" } : {},
      }}
    >
      <Stack spacing={1} sx={{ height: "100%" }}>
        {avgScore !== null && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 48,
              height: 48,
              borderRadius: "50%",
              backgroundColor: getScoreColor(avgScore),
              color: "white",
              fontWeight: 700,
              fontSize: "1.25rem",
              fontFamily: MONO,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {avgScore.toFixed(1)}
          </Box>
        )}

        <Typography
          variant="caption"
          noWrap
          sx={{
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {modelResult.response.slice(0, 50)}...
        </Typography>

        <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
          <Chip
            label={`${modelResult.latency_ms}ms`}
            size="small"
            variant="outlined"
          />
          <Chip
            label={`$${modelResult.cost_usd.toFixed(5)}`}
            size="small"
            variant="outlined"
          />
        </Stack>

        {onClickDetail && (
          <Button size="small" onClick={onClickDetail} sx={{ mt: "auto" }}>
            Details
          </Button>
        )}
      </Stack>
    </Box>
  );
}

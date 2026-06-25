import React from "react";
import { Box, CircularProgress, Chip, Stack, Typography, Button } from "@mui/material";
import { ModelResultEvent, JudgeResultEvent } from "../types/benchmark";

interface ResultCellProps {
  modelResult?: ModelResultEvent;
  judgeResults?: JudgeResultEvent[];
  onClickDetail?: () => void;
}

function getScoreColor(score: number): string {
  if (score >= 8) return "#16a34a";
  if (score >= 6) return "#d97706";
  if (score >= 4) return "#ea580c";
  return "#dc2626";
}

export function ResultCell({
  modelResult,
  judgeResults,
  onClickDetail,
}: ResultCellProps) {
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
        transition: "all 0.2s",
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

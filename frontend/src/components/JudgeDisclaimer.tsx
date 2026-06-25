import React from "react";
import { Alert, Typography } from "@mui/material";

export function JudgeDisclaimer() {
  return (
    <Alert severity="info" icon={<span>⚖️</span>}>
      <Typography variant="body2">
        Judged by our free-tier panel — they work for exposure, not tokens.
      </Typography>
    </Alert>
  );
}

import React from "react";
import { Alert, Typography } from "@mui/material";
import GavelIcon from "@mui/icons-material/Gavel";

export function JudgeDisclaimer() {
  return (
    <Alert severity="info" icon={<GavelIcon fontSize="small" />}>
      <Typography variant="body2">
        Scores are assigned by an LLM-as-judge. Results reflect the judge model's
        interpretation and should be validated against your own evaluation criteria.
      </Typography>
    </Alert>
  );
}

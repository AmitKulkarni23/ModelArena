import React from "react";
import {
  Box,
  Typography,
  Stack,
  Chip,
  useTheme,
} from "@mui/material";
import SavingsOutlinedIcon from "@mui/icons-material/SavingsOutlined";
import { RecommendationEvent } from "../types/results";

interface RecommendationCardProps {
  recommendation: RecommendationEvent;
}

export function RecommendationCard({ recommendation }: RecommendationCardProps) {
  const theme = useTheme();
  const primaryPct = Math.round(recommendation.traffic_split * 100);
  const frontierPct = 100 - primaryPct;

  return (
    <Box
      sx={{
        backgroundColor: "#0f172a",
        borderRadius: 2,
        overflow: "hidden",
        color: "#fff",
      }}
    >
      {/* Header bar */}
      <Box
        sx={{
          px: 3,
          py: 1.5,
          backgroundColor: "#1e293b",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <SavingsOutlinedIcon sx={{ fontSize: 16, color: "#818cf8" }} />
        <Typography
          sx={{
            fontSize: "0.7rem",
            fontWeight: 700,
            color: "#818cf8",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Routing Recommendation
        </Typography>
      </Box>

      <Box sx={{ p: 3 }}>
        {/* Model split */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr auto 1fr" },
            gap: 2,
            alignItems: "center",
            mb: 3,
          }}
        >
          {/* Primary model */}
          <Box>
            <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", mb: 0.75 }}>
              Primary — {primaryPct}%
            </Typography>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
              {recommendation.primary_model_name}
            </Typography>
          </Box>

          {/* Traffic split bar */}
          <Box sx={{ display: { xs: "none", sm: "block" }, minWidth: 140 }}>
            <Box
              sx={{
                height: 6,
                borderRadius: 3,
                overflow: "hidden",
                backgroundColor: "rgba(255,255,255,0.08)",
                display: "flex",
              }}
            >
              <Box
                sx={{
                  width: `${primaryPct}%`,
                  backgroundColor: theme.palette.primary.main,
                  transition: "width 0.3s ease",
                }}
              />
              <Box
                sx={{
                  width: `${frontierPct}%`,
                  backgroundColor: theme.palette.secondary.main,
                }}
              />
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
              <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>{primaryPct}%</Typography>
              <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>{frontierPct}%</Typography>
            </Box>
          </Box>

          {/* Frontier model */}
          <Box sx={{ textAlign: { xs: "left", sm: "right" } }}>
            <Typography sx={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.55)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", mb: 0.75 }}>
              Frontier — {frontierPct}%
            </Typography>
            <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: "rgba(255,255,255,0.75)", letterSpacing: "-0.01em" }}>
              {recommendation.frontier_model_name}
            </Typography>
          </Box>
        </Box>

        {/* Mobile split bar */}
        <Box sx={{ display: { xs: "block", sm: "none" }, mb: 2.5 }}>
          <Box sx={{ height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", display: "flex" }}>
            <Box sx={{ width: `${primaryPct}%`, backgroundColor: theme.palette.primary.main }} />
            <Box sx={{ width: `${frontierPct}%`, backgroundColor: theme.palette.secondary.main }} />
          </Box>
        </Box>

        {/* Savings + signals row */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 2,
            pt: 2.5,
            borderTop: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography sx={{ fontSize: "1.5rem", fontWeight: 700, color: "#4ade80", lineHeight: 1 }}>
              {recommendation.estimated_cost_savings_pct}%
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
              estimated<br />cost savings
            </Typography>
          </Box>

          {recommendation.difficulty_signals.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, ml: { xs: 0, sm: "auto" } }}>
              {recommendation.difficulty_signals.map((signal, idx) => (
                <Chip
                  key={idx}
                  label={signal}
                  size="small"
                  sx={{
                    backgroundColor: "rgba(255,255,255,0.07)",
                    color: "rgba(255,255,255,0.55)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    fontSize: "0.675rem",
                    height: 22,
                  }}
                />
              ))}
            </Box>
          )}
        </Box>

        {/* Reasoning */}
        {recommendation.reasoning && (
          <Typography
            sx={{
              mt: 2,
              pt: 2,
              borderTop: "1px solid rgba(255,255,255,0.07)",
              fontSize: "0.8125rem",
              color: "rgba(255,255,255,0.5)",
              lineHeight: 1.7,
            }}
          >
            {recommendation.reasoning}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

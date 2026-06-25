import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Chip,
  Alert,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import { RecommendationEvent } from "../types/results";

interface RecommendationCardProps {
  recommendation: RecommendationEvent;
}

export function RecommendationCard({
  recommendation,
}: RecommendationCardProps) {
  return (
    <Card sx={{ backgroundColor: "primary.light", border: "2px solid", borderColor: "primary.main", mb: 3 }}>
      <CardContent>
        <Stack spacing={2}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            Recommended Routing Strategy
          </Typography>

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <Box>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                Primary Model ({recommendation.traffic_split * 100}%)
              </Typography>
              <Chip
                icon={<TrendingUpIcon />}
                label={recommendation.primary_model_name}
                color="primary"
                variant="filled"
                sx={{ mt: 1 }}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600 }}>
                Frontier Model ({(1 - recommendation.traffic_split) * 100}%)
              </Typography>
              <Chip
                label={recommendation.frontier_model_name}
                color="secondary"
                variant="filled"
                sx={{ mt: 1 }}
              />
            </Box>
          </Box>

          <Alert severity="success" icon={<span>💰</span>}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Save {recommendation.estimated_cost_savings_pct}% on costs
            </Typography>
          </Alert>

          {recommendation.difficulty_signals.length > 0 && (
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600, display: "block", mb: 1 }}>
                Difficulty Signals
              </Typography>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                {recommendation.difficulty_signals.map((signal, idx) => (
                  <Chip key={idx} label={signal} size="small" variant="outlined" />
                ))}
              </Stack>
            </Box>
          )}

          <Typography variant="body2">
            {recommendation.reasoning}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

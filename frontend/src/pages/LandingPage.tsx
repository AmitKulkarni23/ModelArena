import React from "react";
import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
  Card,
  CardContent,
  Grid,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SpeedIcon from "@mui/icons-material/Speed";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

export function LandingPage() {
  return (
    <Container maxWidth="lg" sx={{ py: 8 }}>
      <Stack spacing={8}>
        {/* Hero Section */}
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Typography
            variant="h2"
            sx={{
              fontWeight: 700,
              mb: 2,
              background: "linear-gradient(135deg, #6366f1 0%, #ec4899 100%)",
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Benchmark LLMs Like a Pro
          </Typography>
          <Typography variant="h6" color="textSecondary" sx={{ mb: 4, maxWidth: 600, mx: "auto" }}>
            Compare model quality, speed, and cost. Route traffic intelligently.
            Make data-driven decisions.
          </Typography>
          <Button
            variant="contained"
            size="large"
            endIcon={<PlayArrowIcon />}
            onClick={() => (window.location.hash = "/#/benchmark/new")}
            sx={{ fontSize: "1.1rem", py: 1.5, px: 4 }}
          >
            Start Benchmarking
          </Button>
        </Box>

        {/* How It Works */}
        <Box>
          <Typography
            variant="h4"
            sx={{ fontWeight: 700, mb: 4, textAlign: "center" }}
          >
            How It Works
          </Typography>

          <Grid container spacing={3}>
            {[
              {
                icon: <CompareArrowsIcon sx={{ fontSize: 48 }} />,
                title: "Define Your Test",
                description: "Write a system prompt and add test cases to benchmark.",
              },
              {
                icon: <PlayArrowIcon sx={{ fontSize: 48 }} />,
                title: "Run Benchmark",
                description:
                  "Select models and run. Stream results in real-time.",
              },
              {
                icon: <SpeedIcon sx={{ fontSize: 48 }} />,
                title: "Judge Quality",
                description: "AI judges score responses. No manual evaluation.",
              },
              {
                icon: <AttachMoneyIcon sx={{ fontSize: 48 }} />,
                title: "Optimize Costs",
                description:
                  "Get routing recommendations to minimize your API spend.",
              },
            ].map((step, idx) => (
              <Grid key={idx} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card
                  sx={{
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    p: 2,
                  }}
                >
                  <CardContent>
                    <Box sx={{ color: "primary.main", mb: 2 }}>
                      {step.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                      {step.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {step.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* CTA */}
        <Box sx={{ textAlign: "center", py: 4 }}>
          <Button
            variant="contained"
            size="large"
            endIcon={<PlayArrowIcon />}
            onClick={() => (window.location.hash = "/#/benchmark/new")}
            sx={{ fontSize: "1rem", py: 1.5, px: 4 }}
          >
            Create Your First Benchmark
          </Button>
        </Box>
      </Stack>
    </Container>
  );
}

import React from "react";
import { keyframes } from "@emotion/react";
import {
  Container,
  Box,
  Typography,
  Button,
  Stack,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

const MONO = '"JetBrains Mono", "Fira Code", "Courier New", monospace';

const cursorBlink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

const MOCK_ROWS = [
  { rank: 1, model: "claude-3-5-sonnet", quality: "8.7", latency: "1,240ms", score: "7.9", winner: true },
  { rank: 2, model: "gpt-4o-mini", quality: "7.2", latency: "890ms", score: "6.8", winner: false },
  { rank: 3, model: "llama-3.1-70b", quality: "6.9", latency: "2,100ms", score: "5.8", winner: false },
];

const STEPS = [
  {
    n: "01",
    title: "Configure",
    body: "Write a system prompt and define test cases — each is a user message the models will respond to.",
  },
  {
    n: "02",
    title: "Benchmark",
    body: "Select up to 10 models. Results stream in real-time as models run in parallel via OpenRouter.",
  },
  {
    n: "03",
    title: "Recommend",
    body: "An LLM judge scores each response 1–10. Get a ranked leaderboard and a routing recommendation.",
  },
];

export function LandingPage() {
  const nav = (hash: string) => () => { window.location.hash = hash; };

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
      <Stack spacing={12}>

        {/* ── Hero ─────────────────────────────────────────────── */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "2fr 3fr" },
            gap: { xs: 6, md: 6 },
            alignItems: "center",
          }}
        >
          {/* Left: headline + CTA */}
          <Stack spacing={3.5}>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: "2.25rem", md: "3.25rem" },
                lineHeight: 1.08,
                textWrap: "balance",
                color: "text.primary",
                letterSpacing: "-0.03em",
              }}
            >
              Find the right LLM for your use case.
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: "42ch", lineHeight: 1.75 }}
            >
              Define a prompt and test cases. Benchmark multiple models simultaneously
              via OpenRouter. Get scored results, cost breakdowns, and a routing
              recommendation.
            </Typography>
            <Box>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={nav("/benchmark/new")}
                sx={{ fontSize: "1rem", py: 1.5, px: 4.5 }}
              >
                Run a benchmark
              </Button>
            </Box>
          </Stack>

          {/* Right: mock results preview */}
          <Box
            sx={{
              backgroundColor: "#0f172a",
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
          >
            {/* Window chrome */}
            <Box
              sx={{
                px: 2.5,
                py: 1.25,
                backgroundColor: "#1e293b",
                borderBottom: "1px solid rgba(255,255,255,0.07)",
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Box sx={{ display: "flex", gap: 0.75 }}>
                {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                  <Box key={c} sx={{ width: 9, height: 9, borderRadius: "50%", backgroundColor: c, opacity: 0.65 }} />
                ))}
              </Box>
              <Typography sx={{ fontSize: "0.675rem", color: "rgba(255,255,255,0.35)", ml: 0.75, fontFamily: MONO }}>
                benchmark results — example output
              </Typography>
            </Box>

            <Box sx={{ p: 2.5, fontFamily: MONO }}>
              {/* Column headers */}
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "20px 1fr 52px 58px 44px",
                  gap: "12px",
                  pb: 1,
                  mb: 0.5,
                  borderBottom: "1px solid rgba(255,255,255,0.09)",
                }}
              >
                {["#", "Model", "Quality", "Latency", "Score"].map((h) => (
                  <Typography
                    key={h}
                    sx={{
                      fontSize: "0.625rem",
                      color: "rgba(255,255,255,0.3)",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                      fontFamily: MONO,
                    }}
                  >
                    {h}
                  </Typography>
                ))}
              </Box>

              {/* Data rows */}
              <Stack spacing={0.25}>
                {MOCK_ROWS.map((row) => (
                  <Box
                    key={row.rank}
                    sx={{
                      display: "grid",
                      gridTemplateColumns: "20px 1fr 52px 58px 44px",
                      gap: "12px",
                      alignItems: "center",
                      py: 0.875,
                      px: 0.75,
                      borderRadius: 1,
                      backgroundColor: row.winner ? "rgba(99,102,241,0.1)" : "transparent",
                    }}
                  >
                    <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", fontFamily: MONO }}>
                      {row.rank}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                      <Typography
                        sx={{
                          fontSize: "0.7rem",
                          color: row.winner ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.65)",
                          fontFamily: MONO,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.model}
                      </Typography>
                      {row.winner && (
                        <Typography sx={{ fontSize: "0.575rem", color: "#818cf8", fontWeight: 700, fontFamily: MONO, flexShrink: 0, letterSpacing: "0.04em" }}>
                          ★ TOP
                        </Typography>
                      )}
                    </Box>
                    <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", fontFamily: MONO }}>
                      {row.quality}
                    </Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", fontFamily: MONO }}>
                      {row.latency}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        color: row.winner ? "#818cf8" : "rgba(255,255,255,0.45)",
                        fontFamily: MONO,
                      }}
                    >
                      {row.score}
                    </Typography>
                  </Box>
                ))}
              </Stack>

              {/* Recommendation strip */}
              <Box
                sx={{
                  mt: 2,
                  pt: 1.75,
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <Typography sx={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)", mb: 0.75, fontFamily: MONO, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700 }}>
                  Routing recommendation
                </Typography>
                <Typography sx={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.65)", fontFamily: MONO, lineHeight: 1.7 }}>
                  Route 70%{" "}→{" "}
                  <Box component="span" sx={{ color: "#818cf8" }}>gpt-4o-mini</Box>
                  {"  "}·{"  "}
                  30%{" "}→{" "}
                  <Box component="span" sx={{ color: "#818cf8" }}>claude-3-5-sonnet</Box>
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: "5px", mt: 0.5 }}>
                  <Typography sx={{ fontSize: "0.7rem", color: "#4ade80", fontFamily: MONO }}>
                    ↓ 41% estimated API cost savings
                  </Typography>
                  <Box
                    component="span"
                    sx={{
                      display: "inline-block",
                      width: "7px",
                      height: "13px",
                      backgroundColor: "rgba(255,255,255,0.5)",
                      animation: `${cursorBlink} 1.1s step-end infinite`,
                      flexShrink: 0,
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* ── How it works — numbered 3-step sequence ──────────── */}
        <Box>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            }}
          >
            {STEPS.map((step, idx) => (
              <Box
                key={step.n}
                sx={{
                  px: { xs: 0, md: 4 },
                  pl: { xs: 0, md: idx === 0 ? 0 : 4 },
                  pr: { xs: 0, md: idx === 2 ? 0 : 4 },
                  py: { xs: 4, md: 0 },
                  borderLeft: { xs: "none", md: idx > 0 ? "1px solid" : "none" },
                  borderTop: { xs: idx > 0 ? "1px solid" : "none", md: "none" },
                  borderColor: "divider",
                }}
              >
                <Typography
                  sx={{
                    fontSize: "2rem",
                    fontWeight: 700,
                    color: "primary.main",
                    fontFamily: MONO,
                    mb: 0.75,
                    lineHeight: 1,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {step.n}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {step.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.75 }}>
                  {step.body}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

      </Stack>
    </Container>
  );
}

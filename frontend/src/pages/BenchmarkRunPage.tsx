import React, { useMemo } from "react";
import { Container, Stack, Alert, Button } from "@mui/material";
import { ProgressHeader } from "../components/ProgressHeader";
import { LiveResultsGrid } from "../components/LiveResultsGrid";
import { useBenchmark } from "../hooks/useBenchmark";

export function BenchmarkRunPage() {
  const { state: benchmarkState, cancelBenchmark } = useBenchmark();

  const modelNames = useMemo(() => {
    const names = new Map<string, string>();
    if (benchmarkState.config) {
      benchmarkState.config.model_ids.forEach((id) => {
        names.set(id, id);
      });
    }
    return names;
  }, [benchmarkState.config]);

  const testCaseLabels = useMemo(() => {
    if (benchmarkState.config) {
      return benchmarkState.config.test_cases.map(
        (tc) => tc.label || "Test Case",
      );
    }
    return [];
  }, [benchmarkState.config]);

  if (benchmarkState.phase === "idle") {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">No benchmark running. Start a new one.</Alert>
        <Button
          variant="contained"
          onClick={() => (window.location.hash = "/benchmark/new")}
          sx={{ mt: 2 }}
        >
          Create Benchmark
        </Button>
      </Container>
    );
  }

  if (benchmarkState.connectionError) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">
          Connection lost: {benchmarkState.connectionError}
        </Alert>
        <Button
          variant="contained"
          onClick={() => (window.location.hash = "/")}
          sx={{ mt: 2 }}
        >
          Back to Home
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <ProgressHeader
          modelTasksCompleted={benchmarkState.progress.modelTasksCompleted}
          modelTasksTotal={benchmarkState.progress.modelTasksTotal}
          judgeTasksCompleted={benchmarkState.progress.judgeTasksCompleted}
          judgeTasksTotal={benchmarkState.progress.judgeTasksTotal}
          onCancel={cancelBenchmark}
        />

        <LiveResultsGrid
          modelNames={modelNames}
          testCaseLabels={testCaseLabels}
          modelResults={benchmarkState.modelResults}
          judgeResults={benchmarkState.judgeResults}
          errors={benchmarkState.errors}
        />

        {benchmarkState.phase === "complete" && (
          <Alert severity="success">
            {benchmarkState.progress.modelTasksTotal} model{benchmarkState.progress.modelTasksTotal !== 1 ? "s" : ""} scored.{" "}
            Redirecting to results...
          </Alert>
        )}
      </Stack>
    </Container>
  );
}

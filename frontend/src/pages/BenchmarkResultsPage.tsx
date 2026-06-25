import React, { useMemo, useState } from "react";
import { Container, Stack, Alert, Button, Typography, Box, Divider } from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { RecommendationCard } from "../components/RecommendationCard";
import { RankingsTable } from "../components/RankingsTable";
import { ResultsMatrix } from "../components/ResultsMatrix";
import { ResponseDetailDialog } from "../components/ResponseDetailDialog";
import { JudgeDisclaimer } from "../components/JudgeDisclaimer";
import { useBenchmark } from "../hooks/useBenchmark";
import { useModels } from "../hooks/useModels";

export function BenchmarkResultsPage() {
  const { state: benchmarkState, reset } = useBenchmark();
  const { models } = useModels();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    modelId: string;
    testCaseIdx: number;
  } | null>(null);

  const selectedModels = useMemo(() => {
    if (benchmarkState.config) {
      return models.filter((m) =>
        benchmarkState.config?.model_ids.includes(m.id),
      );
    }
    return [];
  }, [models, benchmarkState.config]);

  const handleCellClick = (modelId: string, testCaseIdx: number) => {
    setSelectedCell({ modelId, testCaseIdx });
    setDetailDialogOpen(true);
  };

  const selectedCellData = useMemo(() => {
    if (!selectedCell || !benchmarkState.config) return null;
    const key = `${selectedCell.modelId}:${selectedCell.testCaseIdx}`;
    const modelResult = benchmarkState.modelResults.get(key);
    const judgeResults = benchmarkState.judgeResults.get(key);
    const modelName = selectedModels.find((m) => m.id === selectedCell.modelId)?.name;
    const testCase = benchmarkState.config.test_cases[selectedCell.testCaseIdx];
    return { modelResult, judgeResults, modelName, testCaseInput: testCase?.input };
  }, [selectedCell, benchmarkState.config, benchmarkState.modelResults, benchmarkState.judgeResults, selectedModels]);

  if (benchmarkState.phase !== "complete") {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="info">
          Benchmark not complete. Run a benchmark first.
        </Alert>
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

  if (!benchmarkState.config) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">Configuration missing.</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack spacing={4}>
        {/* Page heading */}
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
            Benchmark Results
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {selectedModels.length} model{selectedModels.length !== 1 ? "s" : ""} ·{" "}
            {benchmarkState.config.test_cases.length} test case{benchmarkState.config.test_cases.length !== 1 ? "s" : ""}
          </Typography>
        </Box>

        {/* Recommendation — visually distinct, no Card wrapper */}
        {benchmarkState.recommendation && (
          <RecommendationCard recommendation={benchmarkState.recommendation} />
        )}

        <Divider />

        {/* Rankings */}
        <RankingsTable
          models={selectedModels}
          modelResults={benchmarkState.modelResults}
          judgeResults={benchmarkState.judgeResults}
          testCaseCount={benchmarkState.config.test_cases.length}
        />

        {/* Results matrix */}
        <ResultsMatrix
          models={selectedModels}
          testCases={benchmarkState.config.test_cases}
          modelResults={benchmarkState.modelResults}
          judgeResults={benchmarkState.judgeResults}
          onCellClick={handleCellClick}
        />

        <JudgeDisclaimer />

        <Box>
          <Button
            variant="outlined"
            endIcon={<ArrowForwardIcon />}
            onClick={() => {
              reset();
              window.location.hash = "/benchmark/new";
            }}
          >
            Run Another Benchmark
          </Button>
        </Box>
      </Stack>

      {selectedCellData && (
        <ResponseDetailDialog
          open={detailDialogOpen}
          onClose={() => setDetailDialogOpen(false)}
          modelResult={selectedCellData.modelResult}
          judgeResults={selectedCellData.judgeResults}
          modelName={selectedCellData.modelName}
          testCaseInput={selectedCellData.testCaseInput}
        />
      )}
    </Container>
  );
}

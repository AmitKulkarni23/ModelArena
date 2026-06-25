import React from "react";
import {
  Stack,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Box,
  Chip,
} from "@mui/material";
import { ModelFilterBar } from "./ModelFilterBar";
import { ModelCard } from "./ModelCard";
import { useModels, ModelFilters } from "../hooks/useModels";
import { ModelSummary } from "../types/models";

interface ModelSelectionStepProps {
  selectedModelIds: string[];
  onToggleModel: (modelId: string) => void;
}

export function ModelSelectionStep({
  selectedModelIds,
  onToggleModel,
}: ModelSelectionStepProps) {
  const {
    models,
    loading,
    error,
    search,
    setSearch,
    filters,
    setFilters,
    filteredModels,
  } = useModels();

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading models...</Typography>
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert severity="error">
        Failed to load models: {error}. Please refresh the page.
      </Alert>
    );
  }

  const selectedModels = models.filter((m) =>
    selectedModelIds.includes(m.id),
  );

  return (
    <Stack spacing={3}>
      <ModelFilterBar
        models={models}
        filters={filters}
        onFiltersChange={setFilters}
        search={search}
        onSearchChange={setSearch}
      />

      {selectedModels.length > 0 && (
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
            Selected Models ({selectedModels.length}/10)
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
            {selectedModels.map((m) => (
              <Chip
                key={m.id}
                label={m.name}
                onDelete={() => onToggleModel(m.id)}
                color="primary"
                variant="filled"
              />
            ))}
          </Stack>
        </Box>
      )}

      <Grid container spacing={2}>
        {filteredModels.map((model) => (
          <Grid key={model.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <ModelCard
              model={model}
              selected={selectedModelIds.includes(model.id)}
              onToggle={onToggleModel}
            />
          </Grid>
        ))}
      </Grid>

      {filteredModels.length === 0 && (
        <Alert severity="info">
          No models match your filters. Try adjusting your search.
        </Alert>
      )}
    </Stack>
  );
}

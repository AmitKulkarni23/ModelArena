import React, { useMemo } from "react";
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
import { useModels } from "../hooks/useModels";

interface ModelSelectionStepProps {
  selectedModelIds: string[];
  onToggleModel: (modelId: string) => void;
  error?: string;
}

export function ModelSelectionStep({
  selectedModelIds,
  onToggleModel,
  error,
}: ModelSelectionStepProps) {
  const {
    models,
    loading,
    error: loadError,
    search,
    setSearch,
    filters,
    setFilters,
    filteredModels,
  } = useModels();

  const selectedModelIdSet = useMemo(() => new Set(selectedModelIds), [selectedModelIds]);
  const selectedModels = useMemo(
    () => models.filter((m) => selectedModelIdSet.has(m.id)),
    [models, selectedModelIdSet],
  );

  if (loading) {
    return (
      <Stack sx={{ alignItems: "center", py: 4 }}>
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>Loading models...</Typography>
      </Stack>
    );
  }

  if (loadError) {
    return (
      <Alert severity="error">
        Failed to load models: {loadError}. Please refresh the page.
      </Alert>
    );
  }
  const count = selectedModelIds.length;
  const atCap = count >= 10;

  return (
    <Stack spacing={2}>
      <ModelFilterBar
        models={models}
        filters={filters}
        onFiltersChange={setFilters}
        search={search}
        onSearchChange={setSearch}
      />

      {/* Selection status */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: atCap ? "warning.main" : count > 0 ? "primary.main" : "text.secondary",
          }}
        >
          {count} / 10 models selected
          {atCap && " — at limit"}
        </Typography>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {atCap && (
        <Alert severity="warning">
          Maximum 10 models selected. Deselect one to swap it out.
        </Alert>
      )}

      {selectedModels.length > 0 && (
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
          {selectedModels.map((m) => (
            <Chip
              key={m.id}
              label={m.name}
              onDelete={() => onToggleModel(m.id)}
              color="primary"
              variant="filled"
              size="small"
            />
          ))}
        </Stack>
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

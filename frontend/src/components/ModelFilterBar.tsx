import React, { useState, useCallback, useMemo } from "react";
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { ModelFilters } from "../hooks/useModels";
import { ModelSummary } from "../types/models";

interface ModelFilterBarProps {
  models: ModelSummary[];
  filters: ModelFilters;
  onFiltersChange: (filters: ModelFilters) => void;
  search: string;
  onSearchChange: (search: string) => void;
}

export function ModelFilterBar({
  models,
  filters,
  onFiltersChange,
  search,
  onSearchChange,
}: ModelFilterBarProps) {
  const [searchInput, setSearchInput] = useState(search);
  const searchTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    searchTimeout.current = setTimeout(() => {
      onSearchChange(value);
    }, 300);
  };

  const providers = useMemo(() => {
    const unique = new Set(models.map((m) => m.provider));
    return Array.from(unique).sort();
  }, [models]);

  return (
    <Stack spacing={2} sx={{ mb: 3 }}>
      <TextField
        placeholder="Search models..."
        size="small"
        fullWidth
        value={searchInput}
        onChange={(e) => handleSearchChange(e.target.value)}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2 }}>
        <FormControl size="small">
          <InputLabel>Modality</InputLabel>
          <Select
            value={filters.modality || ""}
            label="Modality"
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                modality: e.target.value ? (e.target.value as "text" | "multimodal") : undefined,
              })
            }
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="text">Text Only</MenuItem>
            <MenuItem value="multimodal">Multimodal</MenuItem>
          </Select>
        </FormControl>

        <FormControl size="small">
          <InputLabel>Provider</InputLabel>
          <Select
            value={filters.provider || ""}
            label="Provider"
            onChange={(e) =>
              onFiltersChange({
                ...filters,
                provider: e.target.value || undefined,
              })
            }
          >
            <MenuItem value="">All</MenuItem>
            {providers.map((p) => (
              <MenuItem key={p} value={p}>
                {p}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          label="Max Price"
          type="number"
          size="small"
          inputProps={{ step: "0.0001", min: "0" }}
          value={filters.maxPrice || ""}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              maxPrice: e.target.value ? parseFloat(e.target.value) : undefined,
            })
          }
        />

        <FormControlLabel
          control={
            <Switch
              checked={filters.freeOnly || false}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  freeOnly: e.target.checked || undefined,
                })
              }
            />
          }
          label="Free Only"
        />
      </Box>
    </Stack>
  );
}

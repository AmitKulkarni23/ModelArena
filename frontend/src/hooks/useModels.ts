import { useState, useEffect, useMemo, useCallback } from "react";
import { fetchModels } from "../api/models";
import { ModelSummary } from "../types/models";

export interface ModelFilters {
  modality?: "text" | "multimodal";
  provider?: string;
  maxPrice?: number;
  freeOnly?: boolean;
}

export function useModels() {
  const [models, setModels] = useState<ModelSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ModelFilters>({});

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const response = await fetchModels({
          search: search || undefined,
          modality: filters.modality,
          provider: filters.provider,
          max_price: filters.maxPrice,
          free_only: filters.freeOnly,
        });
        if (mounted) {
          setModels(response.models);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load models");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [search, filters]);

  const filteredModels = useMemo(() => {
    let result = models;

    if (search) {
      const query = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.provider.toLowerCase().includes(query),
      );
    }

    return result;
  }, [models, search]);

  return {
    models,
    loading,
    error,
    search,
    setSearch,
    filters,
    setFilters,
    filteredModels,
  };
}

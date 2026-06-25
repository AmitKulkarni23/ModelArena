import { ModelsQuery, ModelsResponse } from "../types/models";

export async function fetchModels(params?: ModelsQuery): Promise<ModelsResponse> {
  const query = new URLSearchParams();

  if (params?.search) query.append("search", params.search);
  if (params?.modality) query.append("modality", params.modality);
  if (params?.provider) query.append("provider", params.provider);
  if (params?.max_price !== undefined) query.append("max_price", String(params.max_price));
  if (params?.free_only) query.append("free_only", "true");

  const queryStr = query.toString();
  const url = `/api/models${queryStr ? "?" + queryStr : ""}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Failed to fetch models: ${response.status}`);
  }

  return response.json();
}

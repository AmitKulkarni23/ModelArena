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
    let message = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      // empty or non-JSON error body
    }
    throw new Error(message);
  }

  return response.json();
}

import {
  BenchmarkConfig,
  BenchmarkStartedEvent,
  ModelResultEvent,
  JudgeResultEvent,
  RecommendationEvent,
  BenchmarkErrorEvent,
} from "../types/benchmark";
import { ModelSummary } from "../types/models";

export interface BenchmarkProgress {
  modelTasksCompleted: number;
  modelTasksTotal: number;
  judgeTasksCompleted: number;
  judgeTasksTotal: number;
  estimatedCostUsd: number;
}

export interface BenchmarkState {
  phase: "idle" | "configuring" | "running" | "complete" | "error";
  config: BenchmarkConfig | null;
  models: ModelSummary[];
  modelsLoading: boolean;
  selectedModels: string[];

  progress: BenchmarkProgress;
  modelResults: Map<string, ModelResultEvent>;
  judgeResults: Map<string, JudgeResultEvent[]>;
  recommendation: RecommendationEvent | null;
  errors: BenchmarkErrorEvent[];
  connectionError: string | null;
}

export type BenchmarkAction =
  | { type: "SET_MODELS"; payload: ModelSummary[] }
  | { type: "SET_MODELS_LOADING"; payload: boolean }
  | { type: "TOGGLE_MODEL"; payload: string }
  | { type: "SET_CONFIG"; payload: BenchmarkConfig }
  | { type: "BENCHMARK_STARTED"; payload: BenchmarkStartedEvent }
  | { type: "MODEL_RESULT"; payload: ModelResultEvent }
  | { type: "JUDGE_RESULT"; payload: JudgeResultEvent }
  | { type: "RECOMMENDATION"; payload: RecommendationEvent }
  | { type: "BENCHMARK_ERROR"; payload: BenchmarkErrorEvent }
  | { type: "CONNECTION_ERROR"; payload: string }
  | { type: "BENCHMARK_DONE" }
  | { type: "RESET" };

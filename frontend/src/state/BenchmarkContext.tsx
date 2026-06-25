import React, { createContext, useReducer, ReactNode } from "react";
import { BenchmarkState, BenchmarkAction, BenchmarkProgress } from "./types";
import { JudgeResultEvent, ModelResultEvent } from "../types/benchmark";
import { ModelSummary } from "../types/models";

const initialProgress: BenchmarkProgress = {
  modelTasksCompleted: 0,
  modelTasksTotal: 0,
  judgeTasksCompleted: 0,
  judgeTasksTotal: 0,
  estimatedCostUsd: 0,
};

const initialState: BenchmarkState = {
  phase: "idle",
  config: null,
  models: [],
  modelsLoading: false,
  selectedModels: [],
  progress: initialProgress,
  modelResults: new Map(),
  judgeResults: new Map(),
  recommendation: null,
  errors: [],
  connectionError: null,
};

export const BenchmarkContext = createContext<{
  state: BenchmarkState;
  dispatch: React.Dispatch<BenchmarkAction>;
}>({ state: initialState, dispatch: () => {} });

function benchmarkReducer(state: BenchmarkState, action: BenchmarkAction): BenchmarkState {
  switch (action.type) {
    case "SET_MODELS":
      return { ...state, models: action.payload };

    case "SET_MODELS_LOADING":
      return { ...state, modelsLoading: action.payload };

    case "TOGGLE_MODEL": {
      const modelId = action.payload;
      const isSelected = state.selectedModels.includes(modelId);
      return {
        ...state,
        selectedModels: isSelected
          ? state.selectedModels.filter((id) => id !== modelId)
          : [...state.selectedModels, modelId],
      };
    }

    case "SET_CONFIG":
      return {
        ...state,
        phase: "configuring",
        config: action.payload,
        selectedModels: action.payload.model_ids,
      };

    case "BENCHMARK_STARTED": {
      const event = action.payload;
      return {
        ...state,
        phase: "running",
        progress: {
          modelTasksCompleted: 0,
          modelTasksTotal: event.model_ids.length * event.test_case_count,
          judgeTasksCompleted: 0,
          judgeTasksTotal: event.model_ids.length * event.test_case_count,
          estimatedCostUsd: 0,
        },
        errors: [],
        connectionError: null,
      };
    }

    case "MODEL_RESULT": {
      const event = action.payload;
      const key = `${event.model_id}:${event.test_case_idx}`;
      const newModelResults = new Map(state.modelResults);
      newModelResults.set(key, event);

      return {
        ...state,
        modelResults: newModelResults,
        progress: {
          ...state.progress,
          modelTasksCompleted: state.progress.modelTasksCompleted + 1,
          estimatedCostUsd: state.progress.estimatedCostUsd + event.cost_usd,
        },
      };
    }

    case "JUDGE_RESULT": {
      const event = action.payload;
      const key = `${event.model_id}:${event.test_case_idx}`;
      const newJudgeResults = new Map(state.judgeResults);
      const existing = newJudgeResults.get(key) || [];
      newJudgeResults.set(key, [...existing, event]);

      return {
        ...state,
        judgeResults: newJudgeResults,
        progress: {
          ...state.progress,
          judgeTasksCompleted: state.progress.judgeTasksCompleted + 1,
        },
      };
    }

    case "RECOMMENDATION":
      return { ...state, recommendation: action.payload };

    case "BENCHMARK_ERROR":
      return {
        ...state,
        errors: [...state.errors, action.payload],
      };

    case "CONNECTION_ERROR":
      return {
        ...state,
        connectionError: action.payload,
        phase: "error",
      };

    case "BENCHMARK_DONE":
      return { ...state, phase: "complete" };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function BenchmarkProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(benchmarkReducer, initialState);

  return (
    <BenchmarkContext.Provider value={{ state, dispatch }}>
      {children}
    </BenchmarkContext.Provider>
  );
}

export function useBenchmarkContext() {
  const context = React.useContext(BenchmarkContext);
  if (!context) {
    throw new Error("useBenchmarkContext must be used within BenchmarkProvider");
  }
  return context;
}

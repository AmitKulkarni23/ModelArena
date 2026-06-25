import { useCallback, useRef } from "react";
import { useBenchmarkContext } from "../state/BenchmarkContext";
import { startBenchmark } from "../api/benchmark";
import { BenchmarkConfig } from "../types/benchmark";

export function useBenchmark() {
  const { state, dispatch } = useBenchmarkContext();
  const abortControllerRef = useRef<AbortController | null>(null);

  const runBenchmark = useCallback((config: BenchmarkConfig) => {
    dispatch({ type: "SET_CONFIG", payload: config });

    const controller = startBenchmark(
      {
        system_prompt: config.system_prompt,
        test_cases: config.test_cases,
        model_ids: config.model_ids,
        judge_model_ids: config.judge_model_ids,
        rubric_criteria: config.rubric_criteria,
      },
      {
        onBenchmarkStarted: (data) => {
          dispatch({ type: "BENCHMARK_STARTED", payload: data });
        },
        onModelResult: (data) => {
          dispatch({ type: "MODEL_RESULT", payload: data });
        },
        onJudgeResult: (data) => {
          dispatch({ type: "JUDGE_RESULT", payload: data });
        },
        onRecommendation: (data) => {
          dispatch({ type: "RECOMMENDATION", payload: data });
        },
        onError: (data) => {
          dispatch({ type: "BENCHMARK_ERROR", payload: data });
        },
        onDone: () => {
          dispatch({ type: "BENCHMARK_DONE" });
        },
        onConnectionError: (error) => {
          dispatch({ type: "CONNECTION_ERROR", payload: error.message });
        },
      },
    );

    abortControllerRef.current = controller;
  }, [dispatch]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    dispatch({ type: "RESET" });
  }, [dispatch]);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, [dispatch]);

  return {
    state,
    startBenchmark: runBenchmark,
    cancelBenchmark: cancel,
    reset,
  };
}

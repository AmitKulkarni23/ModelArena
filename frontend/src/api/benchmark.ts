import {
  BenchmarkRequest,
  BenchmarkStartedEvent,
  ModelResultEvent,
  JudgeResultEvent,
  RecommendationEvent,
  BenchmarkErrorEvent,
} from "../types/benchmark";

export interface BenchmarkCallbacks {
  onBenchmarkStarted: (data: BenchmarkStartedEvent) => void;
  onModelResult: (data: ModelResultEvent) => void;
  onJudgeResult: (data: JudgeResultEvent) => void;
  onRecommendation: (data: RecommendationEvent) => void;
  onError: (data: BenchmarkErrorEvent) => void;
  onDone: () => void;
  onConnectionError: (error: Error) => void;
}

function dispatchEvent(
  event: string,
  data: unknown,
  callbacks: BenchmarkCallbacks,
): void {
  switch (event) {
    case "benchmark_started":
      callbacks.onBenchmarkStarted(data as BenchmarkStartedEvent);
      break;
    case "model_result":
      callbacks.onModelResult(data as ModelResultEvent);
      break;
    case "judge_result":
      callbacks.onJudgeResult(data as JudgeResultEvent);
      break;
    case "recommendation":
      callbacks.onRecommendation(data as RecommendationEvent);
      break;
    case "error":
      callbacks.onError(data as BenchmarkErrorEvent);
      break;
    case "done":
      callbacks.onDone();
      break;
  }
}

export function startBenchmark(
  request: BenchmarkRequest,
  callbacks: BenchmarkCallbacks,
): AbortController {
  const controller = new AbortController();

  fetch("/api/benchmark", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal: controller.signal,
  })
    .then(async (response) => {
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

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      function processStream(): Promise<void> {
        return reader.read().then(({ done, value }) => {
          if (done) {
            callbacks.onDone();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ") && currentEvent) {
              const data = JSON.parse(line.slice(6));
              dispatchEvent(currentEvent, data, callbacks);
              currentEvent = "";
            }
          }

          return processStream();
        });
      }

      return processStream();
    })
    .catch((err) => {
      if (err.name !== "AbortError") {
        callbacks.onConnectionError(err);
      }
    });

  return controller;
}

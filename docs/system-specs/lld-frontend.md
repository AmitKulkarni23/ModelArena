# LLD: Frontend SPA

**Service:** Frontend SPA (React + TypeScript + MUI)
**Date:** 2026-06-24
**HLD ref:** `docs/system-specs/hld-modelarena.md` §3.1

---

## 1. API Contract (Client-Side)

### API Client Module

```typescript
// src/api/models.ts
export async function fetchModels(params?: ModelsQuery): Promise<ModelsResponse>;

// src/api/benchmark.ts
export function startBenchmark(
  request: BenchmarkRequest,
  callbacks: BenchmarkCallbacks,
): AbortController;

interface BenchmarkCallbacks {
  onBenchmarkStarted: (data: BenchmarkStartedEvent) => void;
  onModelResult: (data: ModelResultEvent) => void;
  onJudgeResult: (data: JudgeResultEvent) => void;
  onRecommendation: (data: RecommendationEvent) => void;
  onError: (data: BenchmarkErrorEvent) => void;
  onDone: () => void;
  onConnectionError: (error: Error) => void;
}
```

### SSE Client Implementation

```typescript
// src/api/benchmark.ts
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
    .then((response) => {
      if (!response.ok) {
        return response.json().then((err) => {
          throw new Error(err.message || `HTTP ${response.status}`);
        });
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

function dispatchEvent(
  event: string,
  data: unknown,
  callbacks: BenchmarkCallbacks,
) {
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
```

---

## 2. Database Schema

No database. All state in React context.

---

## 3. Component Design

### Page Structure (Hash Routing)

```
/#/                → Landing page (hero + CTA)
/#/benchmark/new   → Create benchmark (prompt + test cases + model selection)
/#/benchmark/run   → Running benchmark (progress + streaming results)
/#/benchmark/results → Results dashboard (matrix + rankings + recommendation)
```

### Component Tree

```
App
├── ThemeProvider (MUI theme)
├── AppBar
│   ├── Logo
│   └── Navigation links
│
├── LandingPage                         /#/
│   ├── HeroSection
│   ├── HowItWorksSection
│   └── CTAButton → navigates to /#/benchmark/new
│
├── BenchmarkCreatePage                 /#/benchmark/new
│   ├── Stepper (MUI Stepper, 3 steps)
│   │
│   ├── Step 1: PromptConfigStep
│   │   ├── SystemPromptInput (MUI TextField, multiline)
│   │   └── TestCaseList
│   │       ├── TestCaseCard (repeatable)
│   │       │   ├── InputField (MUI TextField, multiline)
│   │       │   ├── ExpectedOutputField (MUI TextField, optional, collapsible)
│   │       │   ├── LabelField (MUI TextField, short)
│   │       │   └── RemoveButton
│   │       └── AddTestCaseButton
│   │
│   ├── Step 2: ModelSelectionStep
│   │   ├── SearchBar (MUI TextField + debounced search)
│   │   ├── FilterBar
│   │   │   ├── PriceRangeSlider (MUI Slider)
│   │   │   ├── ModalitySelect (MUI Select)
│   │   │   ├── ProviderSelect (MUI Select)
│   │   │   └── FreeOnlyToggle (MUI Switch)
│   │   ├── ModelGrid (MUI DataGrid or Card grid)
│   │   │   └── ModelCard (repeatable)
│   │   │       ├── ModelName + Provider chip
│   │   │       ├── Price per 1M tokens (in/out)
│   │   │       ├── Context length badge
│   │   │       ├── Modality icons
│   │   │       └── SelectCheckbox
│   │   ├── SelectedModelsChips (MUI Chip array, 3-10)
│   │   └── SelectionCount ("4 of 10 models selected")
│   │
│   ├── Step 3: ReviewStep
│   │   ├── ConfigSummary
│   │   │   ├── System prompt preview (truncated)
│   │   │   ├── Test case count
│   │   │   ├── Selected models list
│   │   │   └── Judge models (auto-selected, shown as info)
│   │   ├── CostEstimate
│   │   │   ├── Estimated total cost (bold)
│   │   │   ├── Per-model breakdown
│   │   │   └── "Judge costs: $0 (free tier)" callout
│   │   └── RunBenchmarkButton (MUI Button, primary)
│   │
│   └── JudgeConfigAccordion (optional, collapsed by default)
│       ├── JudgeModelSelector (multi-select from free models)
│       └── RubricCriteriaEditor (editable chip list)
│
├── BenchmarkRunPage                    /#/benchmark/run
│   ├── ProgressHeader
│   │   ├── OverallProgress (MUI LinearProgress)
│   │   ├── Phase indicator ("Running models..." → "Judging..." → "Analyzing...")
│   │   ├── TaskCounter ("12 of 30 model calls complete")
│   │   └── CancelButton
│   ├── LiveResultsGrid
│   │   └── ResultCell (model × test case grid)
│   │       ├── Spinner (pending)
│   │       ├── ResponsePreview (completed, truncated)
│   │       ├── LatencyChip
│   │       ├── CostChip
│   │       └── ScoreBadge (when judge result arrives)
│   └── ErrorLog (collapsible, shows error events)
│
└── BenchmarkResultsPage                /#/benchmark/results
    ├── RecommendationCard (top, prominent)
    │   ├── PrimaryModelBadge ("Use X for 80% of traffic")
    │   ├── FrontierModelBadge ("Use Y for hard 20%")
    │   ├── SavingsHighlight ("Save 73%")
    │   ├── DifficultySignals (chips)
    │   └── ReasoningText
    │
    ├── RankingsTable (MUI DataGrid, sortable)
    │   ├── Columns: Rank, Model, Avg Quality, Avg Latency, Total Cost, Cost/1K, Composite
    │   └── Row click → expands detail
    │
    ├── ResultsMatrix (MUI Table, scrollable)
    │   ├── Rows: Models
    │   ├── Columns: Test cases
    │   ├── Cells: Quality score (color-coded 1-10) + latency + cost
    │   └── Cell click → opens ResponseDetailDialog
    │
    ├── ResponseDetailDialog (MUI Dialog)
    │   ├── Full model response text
    │   ├── Judge scores breakdown (per judge, per criterion)
    │   ├── Judge reasoning text
    │   ├── Latency + TTFB
    │   └── Cost breakdown (tokens in/out × price)
    │
    └── JudgeDisclaimer
        └── "⚖️ Judged by our free-tier panel..."
```

### State Management

React Context + useReducer. No external state library (POC scope, single data flow).

```typescript
// src/state/BenchmarkContext.tsx

interface BenchmarkState {
  phase: "idle" | "configuring" | "running" | "complete" | "error";
  config: BenchmarkConfig | null;
  models: ModelSummary[];               // From Models Lambda
  modelsLoading: boolean;
  selectedModels: string[];             // Model IDs

  // Benchmark run state
  progress: {
    modelTasksCompleted: number;
    modelTasksTotal: number;
    judgeTasksCompleted: number;
    judgeTasksTotal: number;
    estimatedCostUsd: number;
  };
  modelResults: Map<string, ModelResultEvent>;    // key: `${model_id}:${tc_idx}`
  judgeResults: Map<string, JudgeResultEvent[]>;  // key: `${model_id}:${tc_idx}`
  recommendation: RecommendationEvent | null;
  errors: BenchmarkErrorEvent[];
}

type BenchmarkAction =
  | { type: "SET_MODELS"; payload: ModelSummary[] }
  | { type: "SET_MODELS_LOADING"; payload: boolean }
  | { type: "TOGGLE_MODEL"; payload: string }
  | { type: "SET_CONFIG"; payload: BenchmarkConfig }
  | { type: "BENCHMARK_STARTED"; payload: BenchmarkStartedEvent }
  | { type: "MODEL_RESULT"; payload: ModelResultEvent }
  | { type: "JUDGE_RESULT"; payload: JudgeResultEvent }
  | { type: "RECOMMENDATION"; payload: RecommendationEvent }
  | { type: "BENCHMARK_ERROR"; payload: BenchmarkErrorEvent }
  | { type: "BENCHMARK_DONE" }
  | { type: "RESET" };
```

### Hooks

```typescript
// src/hooks/useModels.ts
// Fetches model catalog on mount, provides search/filter state
export function useModels(): {
  models: ModelSummary[];
  loading: boolean;
  error: string | null;
  search: string;
  setSearch: (s: string) => void;
  filters: ModelFilters;
  setFilters: (f: ModelFilters) => void;
  filteredModels: ModelSummary[];
};

// src/hooks/useBenchmark.ts
// Manages benchmark lifecycle: start, stream, cancel
export function useBenchmark(): {
  state: BenchmarkState;
  startBenchmark: (config: BenchmarkConfig) => void;
  cancelBenchmark: () => void;
  reset: () => void;
};

// src/hooks/useCostEstimate.ts
// Calculates estimated cost from selected models + test cases
export function useCostEstimate(
  selectedModels: ModelSummary[],
  testCases: TestCase[],
  systemPrompt: string,
): number;
```

---

## 4. Algorithm Details

### Client-Side Cost Estimation

```typescript
function estimateCost(
  models: ModelSummary[],
  testCases: TestCase[],
  systemPrompt: string,
): number {
  const systemTokens = Math.ceil(systemPrompt.length / 4);
  const estimatedOutputTokens = 500;

  return models.reduce((total, model) => {
    const modelCost = testCases.reduce((tc_total, tc) => {
      const inputTokens = systemTokens + Math.ceil(tc.input.length / 4);
      const expectedTokens = tc.expected_output
        ? Math.ceil(tc.expected_output.length / 4)
        : 0;
      const promptCost =
        (inputTokens + expectedTokens) *
        (model.pricing.prompt_per_million / 1_000_000);
      const completionCost =
        estimatedOutputTokens *
        (model.pricing.completion_per_million / 1_000_000);
      return tc_total + promptCost + completionCost;
    }, 0);
    return total + modelCost;
  }, 0);
}
```

### Score Color Mapping

```typescript
function getScoreColor(score: number): string {
  if (score >= 8) return "#16a34a"; // Green
  if (score >= 6) return "#d97706"; // Amber
  if (score >= 4) return "#ea580c"; // Orange
  return "#dc2626"; // Red
}
```

### Debounced Model Search

```typescript
// 300ms debounce on search input to avoid excessive API calls
// Client-side filtering (models already loaded), so debounce is for UI responsiveness
const debouncedSearch = useMemo(
  () => debounce((query: string) => setSearch(query), 300),
  [],
);
```

---

## 5. Error Handling

| Error | User experience |
|-------|----------------|
| Models API fails to load | "Failed to load model catalog. Retry?" with retry button. |
| Benchmark connection lost | "Connection lost. Your benchmark may still be running but results can't be received. Start a new run?" |
| Single model error in stream | Show error icon in that cell of the results grid. Other models continue. Tooltip shows error message. |
| Judge parse error | Show warning icon on score. Tooltip: "Judge returned unparseable response — using default score." |
| All models fail | Full-page error state: "All model calls failed. Check your OpenRouter API key and try again." |
| Request validation (400) | Inline form errors on the relevant fields in the create page. |
| Lambda timeout (504) | "Benchmark timed out. Try fewer models or test cases." |

---

## 6. Test Plan

### Unit Tests

| Component/Hook | Test |
|----------------|------|
| `useCostEstimate` | Correct calculation with known prices; handles free models (cost = 0); updates when models change |
| `benchmarkReducer` | MODEL_RESULT accumulates correctly; JUDGE_RESULT appends to correct key; BENCHMARK_DONE sets phase to complete; RESET clears all state |
| `getScoreColor` | Returns green for 8+; amber for 6-7; orange for 4-5; red for 1-3 |
| `dispatchEvent` | Routes each SSE event type to correct callback; ignores unknown event types |
| `SSE parser` | Handles split chunks (event and data across reads); handles multiple events in one chunk; handles empty lines |

### Integration Tests

| Test | Description |
|------|-------------|
| `create_flow` | Fill system prompt → add 2 test cases → select 3 models → verify review step shows correct summary |
| `run_flow_mock` | Start benchmark with mocked SSE stream → verify progress updates → verify results page shows matrix |
| `cancel_flow` | Start benchmark → click cancel → verify abort controller fires → verify UI returns to create page |
| `error_handling` | Mock SSE error event → verify error appears in UI → verify other results still display |

### Visual / Manual Tests

| Test | Check |
|------|-------|
| Model selection grid | Responsive layout; filters work; search debounces; chips show selected models |
| Results matrix | Scrollable when many test cases; color-coded scores; cell click opens dialog |
| Recommendation card | Prominent display; savings highlighted; difficulty signals as chips |
| Mobile/tablet | Stepper collapses; grid scrolls horizontally; dialog is full-screen on mobile |

---

## 7. Frontend File Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── bun.lock
└── src/
    ├── main.tsx                         # Vite entry
    ├── App.tsx                          # Root: ThemeProvider + Router + BenchmarkProvider
    ├── theme.ts                         # MUI theme configuration
    │
    ├── api/
    │   ├── models.ts                    # fetchModels()
    │   └── benchmark.ts                 # startBenchmark() SSE client
    │
    ├── state/
    │   ├── BenchmarkContext.tsx          # Context + Provider + useReducer
    │   └── types.ts                     # State types, action types
    │
    ├── hooks/
    │   ├── useModels.ts
    │   ├── useBenchmark.ts
    │   └── useCostEstimate.ts
    │
    ├── pages/
    │   ├── LandingPage.tsx
    │   ├── BenchmarkCreatePage.tsx
    │   ├── BenchmarkRunPage.tsx
    │   └── BenchmarkResultsPage.tsx
    │
    ├── components/
    │   ├── AppBar.tsx
    │   ├── PromptConfigStep.tsx
    │   ├── TestCaseCard.tsx
    │   ├── TestCaseList.tsx
    │   ├── ModelSelectionStep.tsx
    │   ├── ModelCard.tsx
    │   ├── ModelFilterBar.tsx
    │   ├── ReviewStep.tsx
    │   ├── CostEstimate.tsx
    │   ├── ProgressHeader.tsx
    │   ├── LiveResultsGrid.tsx
    │   ├── ResultCell.tsx
    │   ├── RecommendationCard.tsx
    │   ├── RankingsTable.tsx
    │   ├── ResultsMatrix.tsx
    │   ├── ResponseDetailDialog.tsx
    │   └── JudgeDisclaimer.tsx
    │
    └── types/
        ├── models.ts                    # ModelSummary, ModelsQuery, ModelsResponse
        ├── benchmark.ts                 # BenchmarkRequest, TestCase, SSE event types
        └── results.ts                   # ModelRanking, RoutingPolicy, RecommendationEvent
```

---

## 8. Vite Configuration

```typescript
// vite.config.ts
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react()],
    build: { outDir: "dist", emptyOutDir: true },
    server: {
      proxy: {
        "/api/models": {
          target: env.MODELS_LAMBDA_URL ?? "http://localhost:9001",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
        "/api/benchmark": {
          target: env.ORCHESTRATOR_LAMBDA_URL ?? "http://localhost:9002",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
```

---

## 9. MUI Theme

```typescript
// src/theme.ts
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#6366f1" },       // Indigo — distinct from Radar's blue
    secondary: { main: "#ec4899" },     // Pink accent
    background: {
      default: "#fafafa",
      paper: "#ffffff",
    },
    success: { main: "#16a34a" },
    warning: { main: "#d97706" },
    error: { main: "#dc2626" },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: { fontWeight: 700 },
    h2: { fontWeight: 700 },
    h3: { fontWeight: 600 },
    body1: { fontSize: "0.9375rem" },
    fontWeightBold: 700,
  },
  shape: { borderRadius: 12 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { boxShadow: "0 1px 3px rgba(0,0,0,0.08)" },
      },
    },
  },
});
```

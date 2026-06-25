# ModelArena

LLM benchmarking tool — "which model should we use?" as a service. Benchmarks models via OpenRouter on quality (LLM-as-judge), latency, and cost.

## Stack

| Layer | Tech |
|-------|------|
| Backend | Rust, cargo-lambda, Lambda Function URLs |
| Frontend | React 19 + TypeScript + MUI 7, Vite, Bun runtime |
| Infra | CDK (TypeScript), CloudFront + S3 + Lambda |
| LLM API | OpenRouter (`https://openrouter.ai/api/v1`) |

## Project Structure

```
backend/           # Rust Lambda functions (cargo workspaces)
  models/          # GET /models — proxy OpenRouter catalog
  orchestrator/    # POST /benchmark — fan-out, judge, recommend (SSE stream)
frontend/          # React SPA
  src/
    pages/         # Route components
    components/    # Reusable UI
    api/           # API client modules
    types/         # TypeScript types
infra/             # CDK stack (ModelArenaStack)
  lib/
  bin/
docs/              # System specs, references
  system-specs/    # HLD, LLD docs
  references.md    # OpenRouter API docs, crate list
```

## Build & Run

```bash
# Frontend
cd frontend && bun install && bun run dev

# Lambda (requires cargo-lambda)
cd backend/models && cargo lambda build --release
cd backend/orchestrator && cargo lambda build --release

# Deploy
make deploy   # builds all + cdk deploy
```

## Conventions

- Follow Radar project patterns (`~/TechProjects/Radar/`) for CDK, Lambda, and frontend structure
- Origin-verify header pattern for CloudFront → Lambda security
- Structured JSON logging via `tracing` crate
- No native Rust builds on macOS — use cargo-lambda (cross-compiles via Zig)
- System specs live in `docs/system-specs/`

## Environment

OpenRouter API key stored in `.env` (gitignored). Lambda reads from env var `OPENROUTER_API_KEY`.

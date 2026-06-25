# ModelArena — References

## OpenRouter API

| Resource | URL |
|----------|-----|
| Quickstart | https://openrouter.ai/docs/quickstart |
| API - Chat Completions | `POST https://openrouter.ai/api/v1/chat/completions` |
| API - Models List | `GET https://openrouter.ai/api/v1/models` |
| Full docs index (llms.txt) | https://openrouter.ai/docs/llms.txt |
| Model catalog (browse) | https://openrouter.ai/models |
| Request builder (interactive) | https://openrouter.ai/request-builder |
| FAQ (rate limits, free models) | https://openrouter.ai/docs/faq |

## OpenRouter Key Concepts

- **Auth:** `Authorization: Bearer <OPENROUTER_API_KEY>` header
- **Model IDs:** `provider/model-name` (e.g., `anthropic/claude-opus-4.8`, `openai/gpt-5.5`)
- **Free models:** Append `:free` suffix to model ID. Low rate limits. Not for production.
- **Auto router:** `openrouter/free` auto-selects a free model
- **Model variants:** `:free`, `:extended`, `:nitro`, `:thinking`, `:online`, `:exacto`
- **Pricing fields:** `pricing.prompt` and `pricing.completion` (cost per token as string)
- **Streaming:** SSE support on chat completions endpoint

## OpenRouter Model API Response Schema

```json
{
  "id": "provider/model-name",
  "name": "Display Name",
  "context_length": 1000000,
  "architecture": {
    "modality": "text+image->text",
    "input_modalities": ["text", "image"],
    "output_modalities": ["text"],
    "tokenizer": "Provider"
  },
  "pricing": {
    "prompt": "0.000005",
    "completion": "0.00003",
    "input_cache_read": "0.0000005"
  },
  "top_provider": {
    "context_length": 1000000,
    "max_completion_tokens": 128000,
    "is_moderated": false
  },
  "supported_parameters": ["tool_choice", "tools", "structured_outputs"]
}
```

## OpenRouter Features (Relevant to ModelArena)

| Feature | Description |
|---------|-------------|
| Provider routing | Multi-provider, automatic failover |
| Intelligent routers | Auto Router, Fusion Router (multi-model panel) |
| Structured outputs | JSON Schema enforcement |
| Response caching | Cache identical requests |
| Prompt caching | Cross OpenAI/Anthropic/DeepSeek |
| Server-side tools | Web search, URL fetch, fusion, subagent |
| Observability | Broadcast to 20+ platforms (Langfuse, Datadog, etc.) |

## AWS Services Used

| Service | Purpose |
|---------|---------|
| Lambda (Function URLs) | Rust backend — models proxy + benchmark orchestrator |
| S3 | SPA static hosting |
| CloudFront | CDN, HTTPS, routing, security headers |
| CloudWatch | Lambda logs, metrics |

## Rust Crates (Planned)

| Crate | Purpose |
|-------|---------|
| `lambda_http` | AWS Lambda HTTP handler |
| `lambda_runtime` | Lambda runtime (streaming support) |
| `tokio` | Async runtime |
| `reqwest` | HTTP client for OpenRouter API |
| `serde` / `serde_json` | JSON serialization |
| `tracing` / `tracing-subscriber` | Structured logging |

## Frontend Dependencies (Planned)

| Package | Purpose |
|---------|---------|
| React 19 | UI framework |
| MUI 7 | Component library |
| Vite | Bundler |
| Bun | Runtime (install, dev server) |
| TypeScript | Type safety |

## Reference Architecture

- **Radar project** (`~/TechProjects/Radar/`) — CDK patterns, Rust Lambda patterns, CloudFront+S3 hosting, origin-verify header, Makefile build system

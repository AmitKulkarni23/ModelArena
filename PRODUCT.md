# Product

## Register

product

## Users

Solo developer or ML engineer evaluating which LLM to use for a specific task. Arrives with a concrete question ("is GPT-4o worth 3× the cost over Sonnet for my use case?"), runs a benchmark, reads the output, leaves with a data-backed answer. Low ceremony, high signal.

**Secondary audience (non-users):** Recruiters, hiring managers, and founding engineers at OpenRouter reviewing this as a portfolio artifact. They are technical — they read the code and the UI simultaneously. The experience must signal that the builder understands LLM evaluation deeply, not just that they can scaffold a React app.

## Product Purpose

ModelArena benchmarks LLMs against each other on quality (LLM-as-judge), latency, and cost. It fans out a user-defined prompt + test cases across multiple models via OpenRouter, judges each response automatically, scores and ranks models, and recommends routing decisions.

Success: a user can go from "I'm not sure which model to use" to "I have a ranked table with a recommendation" in under five minutes — with reproducible data, not vibes.

## Brand Personality

Precise. Technical. Unambiguous.

Tone: a senior engineer presenting benchmark results, not a startup selling a SaaS product. No adjectives that aren't earned by data. No encouragement. Just signal.

## Anti-references

- Generic SaaS: purple/indigo gradients, hero metrics, cream backgrounds, "Benchmark LLMs Like a Pro" marketing copy. The current landing page is in this failure mode.
- OpenAI minimal white: so stripped-down it communicates nothing. The tool has opinions; the UI should too.
- Enterprise BI (Tableau, Power BI): heavy chart libraries everywhere, legacy blue-gray palettes, data-dump aesthetic.
- Colorful ML notebooks (Colab/Kaggle): playful, notebook-first, not a decision-support tool.
- Flashy ML dashboards (W&B-overload): animation-heavy, too much chrome, buries the actual recommendation.

## Design Principles

1. **Data is the interface.** The benchmark result — ranked table, score matrix, recommendation — is the product. Every screen exists to collect inputs or surface outputs. No decorative chrome.
2. **Technical credibility over visual theater.** Monospace where data lives. Dense tables over padded card grids. Terse copy. The tool should look like something a senior engineer would trust.
3. **One clear recommendation.** ModelArena has an opinion. The winner isn't buried in a table — it's surfaced as an explicit recommendation with a rationale. Confident, not wishy-washy.
4. **Minimal surface, maximum signal.** Every element earns its place. No empty states with mascots, no marketing copy inside the app, no progress spinners with encouragement.
5. **Proof of competence.** As a portfolio piece for a technical audience, the implementation quality IS the message. Correct data handling, sensible defaults, edge cases handled quietly.

## Accessibility & Inclusion

Best-effort WCAG AA. Body text contrast ≥ 4.5:1, keyboard navigable critical paths, semantic HTML for screen readers. No reduced-motion violations.

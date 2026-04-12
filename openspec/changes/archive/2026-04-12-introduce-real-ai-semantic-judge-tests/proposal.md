## Why

Current real-AI validations still rely on brittle string and marker assertions for semantic checks such as "does this reply include a URL" or "did the relay prompt leak the player's move". That is the wrong abstraction level for behavior driven validation, and the repo already has settings inheritance machinery that can supply a dedicated low-cost judge provider without inventing a second configuration path.

## What Changes

- Introduce a real-AI semantic judge test capability that resolves a fixed provider id `jixoai/agenter/test` from the inherited settings cascade.
- Add a generic judge layer for boolean, span, completion-style, and structured JSON semantic decisions on top of the existing model client.
- Add targeted semantic helpers such as `judgeContainsUrl(...)` that perform cheap local pre-checks before paying for a model call.
- Add warning-first availability checks so opt-in real semantic tests skip cleanly when the fixed judge provider is not configured.
- Migrate selected real-AI validations from raw string heuristics to the new judge helpers.

## Capabilities

### New Capabilities

- `real-ai-semantic-judge-tests`: Real-AI semantic testing primitives, fixed-provider resolution, and fast-path helper contracts for backend validation suites.

### Modified Capabilities

- None.

## Impact

- Affected code: `packages/app-server/src/*`, `packages/app-server/test-support/*`, and selected `packages/app-server/test/real-*.test.ts`.
- Affected systems: settings cascade reuse, model-call test utilities, real-AI validation gating.
- Dependencies: existing `@agenter/settings`, `ModelClient`, and `zod` validation stay in use; no new external dependency is required.

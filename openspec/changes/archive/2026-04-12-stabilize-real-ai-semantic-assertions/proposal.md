## Why

The newly introduced real-AI semantic judge infrastructure can now run against the globally configured `jixoai/agenter/test` provider, but live execution shows two remaining weaknesses: a single low-token judge call can return an empty or unstable answer, and several real-AI integration tests still assert semantics through brittle literal strings. We need to harden the semantic judge platform now so real-provider regression runs fail only on real behavior drift, not on output phrasing noise.

## What Changes

- Add redundant real-AI semantic decision execution so boolean/span/completion/structured judges can issue `2~3` parallel attempts and converge on a quorum result instead of trusting one fragile response.
- Preserve the existing two-layer architecture: generic semantic judge primitives stay reusable, while targeted helper functions keep cheap lexical pre-checks before paying for redundant AI calls.
- Replace brittle real-AI semantic assertions in integration suites with semantic-judge-backed checks or structured behavioral contracts, keeping exact-string assertions only for deliberate protocol literals.
- Improve semantic judge diagnostics so disagreement, empty output, or invalid shape errors expose per-attempt evidence instead of a single opaque failure.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `real-ai-semantic-judge-tests`: semantic judge decisions gain redundant quorum execution and real-AI test suites stop relying on brute-force string enumeration for semantic validation.

## Impact

- `packages/app-server/src/semantic-judge.ts`
- `packages/app-server/src/semantic-judge-helpers.ts`
- `packages/app-server/test-support/real-semantic-judge.ts`
- `packages/app-server/test-support/real-loopbus-scenarios.ts`
- `packages/app-server/test/*.integration.test.ts`
- `packages/app-server/SPEC.md`

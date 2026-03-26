## Why

LoopBus currently ingests attention through source adapters, but it still has no native output path. That forces session-runtime to know too much about how attention becomes terminal/message side effects.

## What Changes

- Extend the LoopBus plugin runtime from ingress-only to ingress + egress.
- Add output adapters for routing committed attention items into external systems.
- Add explicit model-call lifecycle hooks with `AbortSignal` propagation.

## Capabilities

### New Capabilities
- `loopbus-attention-output-pipeline`: Route committed attention items through typed egress adapters.

### Modified Capabilities
- `loopbus-plugin-pipeline`: Lifecycle expands beyond attention ingestion to include dispatch and model-call boundaries.

## Impact

- Affected code: `packages/app-server/src/loopbus-plugin-runtime.ts`, `packages/app-server/src/session-runtime.ts`.

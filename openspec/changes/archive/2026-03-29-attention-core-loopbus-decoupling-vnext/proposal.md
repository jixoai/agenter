## Why

The attention runtime still leaks legacy `chat/task/output` contracts into `AgenterAI` and `LoopBus`, which makes the kernel depend on projection details instead of pure attention-state evolution. `compact` is also still modeled as assistant-history surgery instead of what it really is: a special model cycle that rewrites only the model's limited prompt window while persisted attention and session facts keep growing without bound.

## What Changes

- **BREAKING** Remove `chat/task/output` response contracts from `AgenterAI` and `LoopBus`; the core loop only owns attention-centric processing, model calls, and special compact cycles.
- **BREAKING** Remove assistant-fact/task-stage concepts from core model execution and stop treating assistant chat messages as the kernel's native output format.
- Introduce a dedicated prompt-window compaction contract where `compact` runs as a tool-less special cycle, strips tool-call detail from the model window, and replaces it with a structured summary, reusable ready-reply facts, and unresolved attention.
- Keep `SessionRuntime` and WebUI as projection/adaptation layers over persisted attention, message, and cycle facts instead of letting those projections define the kernel API.
- Update backend, real-model, and frontend regression coverage so the new attention-first contract remains observable and testable.

## Capabilities

### New Capabilities

- `attention-prompt-window-compaction`: Define the special compact cycle that rewrites only the model prompt window from structured summary data and unresolved attention.

### Modified Capabilities

- `attention-runtime-kernel`: Runtime kernel behavior changes from chat/task/output orchestration to attention-first processing with projection kept outside the core contract.
- `loopbus-attention-output-pipeline`: LoopBus no longer applies chat, terminal, or task outputs from processor responses; it only schedules processor work and attention/compact lifecycle transitions.
- `assistant-history-facts`: The old assistant-history replay contract is replaced by an attention-centric prompt-window memory contract and structured compact summaries.
- `model-call-lifecycle`: Model-call inspection now exposes prompt-window input state and compact-cycle request semantics instead of assistant-history-centric fields.

## Impact

- `packages/app-server/src/agenter-ai.ts`
- `packages/app-server/src/loop-bus.ts`
- `packages/app-server/src/agent-runtime.ts`
- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/app-kernel.ts`
- `packages/app-server/test/*`
- `packages/webui/src/features/model/*`
- `packages/webui/src/features/process/*`
- `openspec/specs/*` and `openspec/changes/attention-core-loopbus-decoupling-vnext/*`

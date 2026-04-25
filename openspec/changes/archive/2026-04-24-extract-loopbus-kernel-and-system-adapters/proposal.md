## Why

当前 `SessionRuntime` 同时承担了 LoopBus 内核、Attention 协调层、Message/Terminal/Skill 系统接入层，以及 Heartbeat/Devtools 投影层的职责。这个分层坍塌让 `read`、`attention commit`、`ai_call running`、`AI ingress success` 等不同事实被混用，导致系统难以验证，也让未来新增 System 时只能继续向 `SessionRuntime` 堆胶水。

## What Changes

- **BREAKING** Extract a standalone LoopBus kernel that owns attention ingress, dispatch, delivery receipts, and cycle-facing hook truth without importing MessageSystem, TerminalSystem, or RuntimeSkillSystem specifics.
- **BREAKING** Introduce neutral system-kernel adapters so Message, Terminal, Skill, and future Systems publish ingress through one shared contract instead of mutating attention/kernel state directly from `SessionRuntime`.
- **BREAKING** Add durable attention delivery receipts that separate `pending`, `dispatching`, `accepted`, `errored`, `aborted`, and `completed` from message read-state and `ai_call running`.
- Tighten hook semantics so `attentionCommitted` remains commit truth only, while new dispatch/receipt hooks carry AI delivery truth.
- Update runtime publication, Heartbeat, Devtools, and client normalization to consume delivery truth explicitly rather than inferring AI progress from read or running state.
- Require layered acceptance: kernel unit tests, adapter integration tests, runtime orchestration tests, UI/store contract tests, and explicit multi-round review checkpoints against the original layering goal.

## Capabilities

### New Capabilities
- `attention-delivery-receipts`: Durable dispatch and receipt facts that prove when an attention commit was selected, when AI stream acceptance happened, and how each delivery attempt ended.
- `runtime-system-kernel-adapters`: A neutral adapter contract that isolates Message, Terminal, Skill, and future systems from the LoopBus kernel while preserving system-specific ingress semantics.

### Modified Capabilities
- `attention-runtime-kernel`: The runtime kernel boundary changes from a `SessionRuntime`-embedded implementation to a standalone hostable kernel with neutral ingress and delivery laws.
- `attention-commit-hooks`: Hook semantics expand beyond commit-only bridge outcomes to include dispatch and receipt truth with typed delivery states.
- `loopbus-runtime-publication`: Runtime publication adds explicit dispatch/receipt contracts so frontend/runtime inspection can observe delivery truth without raw inference.
- `client-runtime-store`: Runtime store projections and live events change so Heartbeat and related runtime surfaces read delivery truth explicitly.
- `message-read-state`: Message read truth remains message-native and must no longer approximate AI ingress progress.
- `model-call-lifecycle`: `ai_call` lifecycle remains observable, but `running` no longer implies AI acceptance and must bind to attention dispatch/receipt attempts.
- `cycles-devtools-timeline`: Cycle detail must expose hook outcomes separately from attention delivery receipts so technical inspection can distinguish bridge work from model acceptance.

## Impact

- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/model-client.ts`
- `packages/app-server/src/agenter-ai.ts`
- `packages/app-server/src/trpc/router.ts`
- `packages/client-sdk/src/runtime-store.ts`
- `packages/client-sdk/src/types.ts`
- `packages/webui/src/lib/features/runtime/*`
- `packages/attention-system/*` and/or a new kernel package for standalone runtime orchestration
- runtime websocket/publication surfaces for Heartbeat and Devtools
- OpenSpec acceptance artifacts, including layered tests and multi-round review checkpoints

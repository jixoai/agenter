## Context

`AgenterAI` and `LoopBus` still expose legacy `chat/task/output` contracts that were useful for an earlier chat-oriented runtime, but they now violate the attention-first kernel design. The core loop is expected to mutate attention, preserve unresolved debt, and let projection layers derive UI or channel effects from persisted facts. Instead, the current core still returns `ChatMessage`, `TaskStage`, `LoopBusResponse.outputs`, and assistant-history replay structures.

`compact` has the same issue. The logical system is intentionally unbounded, but the model request window is bounded. That means compact is not a data-deletion mechanism; it is a special model cycle that rewrites only the model's working prompt window. Today the implementation still treats compact like assistant-history surgery by pushing `history_summary` back into the same replay stream, and that weak summary shape makes real models miss reusable answers after compaction.

This change spans backend kernel, runtime projection, debug APIs, tests, and frontend inspectors, so the design needs to define a clean contract boundary before implementation continues.

## Goals / Non-Goals

**Goals:**
- Remove `chat/task/output` contracts from `AgenterAI` and `LoopBus`.
- Replace assistant-history memory concepts with an explicit prompt-window model.
- Recast compact as a tool-less special cycle that returns a structured summary plus structured ready-reply facts and seeds the next prompt window.
- Keep `SessionRuntime` and WebUI working as projection layers over persisted facts.
- Preserve real-model verification coverage after the refactor.

**Non-Goals:**
- Redesign the persisted session/message/attention schemas.
- Remove runtime projection APIs or chat UI concepts in the same change.
- Preserve backward compatibility for removed core contracts.
- Solve every remaining legacy concept outside the paths touched by this refactor.

## Decisions

### 1. `AgenterAI` becomes an attention processor, not a chat/task orchestrator

`AgenterAI.send(...)` will stop returning `LoopBusResponse<ChatMessage, TaskStage>` and will instead return a minimal processor result that reflects attention-side effects, compact-window rewrites, and debug metadata. Core-only concepts such as `AssistantFact`, `TaskStage`, `TaskEvent`, and assistant live-message callbacks will be removed from this layer.

Why:
- Those contracts are projection concerns, not kernel laws.
- They force the core to understand chat formatting and task lifecycle semantics.
- They make it harder to verify attention-first behavior with real models.

Alternative considered:
- Keep the generic response wrapper but make fields optional.
- Rejected because optional legacy fields still shape the core API and keep the wrong abstraction alive.

### 2. `LoopBus` becomes a scheduler and lifecycle coordinator only

`LoopBus` will stop normalizing processor outputs into `toUser`, `toTerminal`, and `toTools`, and the `applying_outputs` phase will be removed. A cycle is valid when committed attention changes, compact-window rewrites, or adapter/provider side-effects succeed.

Why:
- The scheduler should not know whether downstream projections look like chat, terminal, or something else.
- Output-array callbacks (`onUserMessage`, `onTerminalDispatch`, `onToolCall`) are direct evidence of core-to-projection coupling.

Alternative considered:
- Keep callbacks as optional plugin hooks.
- Rejected because the phase model and response type would still be shaped around the removed contracts.

### 3. Prompt window replaces assistant-history replay

The model-memory view exposed by `AgenterAI.inspectDebugState()` will be renamed from `history` to `promptWindow`. Normal rounds append factual prompt-window evidence; compact replaces detailed completed memory with a structured summary, structured ready-reply facts, plus unresolved attention. Persisted facts remain canonical and untouched.

Why:
- The system's logical history is infinite; only the model request window is bounded.
- "Assistant history" incorrectly implies chat replay is the native memory form.
- Compact needs a first-class contract so tests can assert what survives and what is intentionally dropped.

Alternative considered:
- Keep assistant-history replay and prepend a `history_summary` message.
- Rejected because it keeps the old concept alive and lets detailed tool history grow again after compaction.

Additional refinement:
- `readyReplies` are modeled as structured facts (`channelId`, `topic`, `triggerPhrases`, `reply`, `reuseWhen`) instead of bare strings so a later follow-up can deterministically reuse the answer instead of re-querying attention or reopening relays.

### 4. Runtime and WebUI stay as projection layers for now

`SessionRuntime`, model inspectors, cycle inspectors, and route status logic will be updated to consume the new core contracts. Runtime may continue to publish projection-friendly state, but it must derive that state from LoopBus lifecycle, persisted facts, and provider side-effects rather than from kernel-native chat/task outputs.

Why:
- The user explicitly wants runtime projection preserved for now.
- Frontend parity is required, but the kernel must stop being shaped by the UI.

Alternative considered:
- Remove projection layers in the same change.
- Rejected because it would expand scope and block delivery of the core cleanup.

## Risks / Trade-offs

- [Risk] Frontend inspectors may still expect `history` or `applying_outputs`. → Mitigation: update server debug payloads, client mappers, and UI stories/tests in the same change.
- [Risk] Some legacy tests assert old assistant-output behavior directly. → Mitigation: rewrite those tests around attention mutations, prompt-window state, and projection-layer facts instead of old response arrays.
- [Risk] Compact summary quality depends on the prompt and real model behavior. → Mitigation: keep deterministic mock tests and rerun real-provider scenarios that cover relay and post-compact follow-up.
- [Risk] Runtime still contains other legacy concepts after the core cleanup. → Mitigation: keep the refactor boundary explicit and document remaining projection-only debt rather than reintroducing it into core interfaces.

## Migration Plan

1. Create OpenSpec deltas for the new prompt-window compaction contract and the affected existing capabilities.
2. Refactor `AgenterAI`, `LoopBus`, and `AgentRuntime` to remove legacy output contracts and adopt prompt-window/compact semantics.
3. Adapt `SessionRuntime`, `AppKernel`, client-sdk, and WebUI inspectors to the new debug and lifecycle shapes while keeping projection surfaces operational.
4. Rewrite or update backend tests, then rerun deterministic and real-model scenarios.
5. Run frontend regression tests and browser walkthroughs on desktop and mobile.

Rollback strategy:
- This is an intentional breaking cleanup. If verification fails, revert the change as a whole instead of reintroducing partial legacy contracts.

## Open Questions

- The `assistant-history-facts` capability name becomes misleading once archived. We may want a follow-up rename to a cleaner `prompt-window-memory` capability after this breaking refactor lands.
- Runtime still has projection-era terminology such as task inbox concepts. Those are out of scope for this change unless they block the core cleanup, but they remain candidates for the next subtraction pass.

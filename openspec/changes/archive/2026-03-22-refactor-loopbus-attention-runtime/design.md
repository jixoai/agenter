## Context

The previous umbrella LoopBus change mixed three different concerns: LoopBus runtime refactor, message/terminal source adaptation, and terminal control-plane migration. That makes the architecture harder to reason about and blurs ownership. The user requirement is stricter: one change should target LoopBus itself, including both backend runtime and frontend/runtime consumers, while message-system and terminal-system adaptation should be handled separately.

Existing building blocks:
- `LoopBus` already provides a stable scheduler and trace model.
- `SessionRuntime` currently owns source collection and LoopBus handoff.
- client-sdk and WebUI already consume runtime snapshots, realtime events, and devtools panels.

The missing slice is a LoopBus-only runtime refactor that defines the core plugin pipeline and the product-facing runtime publication contract.

## Goals / Non-Goals

**Goals:**
- Make attention the primary LoopBus ingestion model.
- Define the core plugin system with explicit hook kinds and ordering.
- Clarify the backend runtime lifecycle independently from source-specific adapters.
- Define the frontend/backend publication contract needed for runtime-store and WebUI devtools migration.

**Non-Goals:**
- Implement message-system and terminal-system source adaptation in this change.
- Expand terminal-system lifecycle/config/transport APIs in this change.
- Build the standalone terminal renderer package in this change.

## Decisions

### LoopBus core owns orchestration, not source specifics
LoopBus defines runtime stages, hook execution, and cycle gating. Source-specific invalidation logic lives in separate integration changes.

Why: this keeps LoopBus conceptually small and makes future adapters easier to plug in.

### Attention-first remains the top-level abstraction
Plugins participate in attention loading/transformation/commit flow before cycle start decisions are made.

Why: this preserves the user's architectural requirement that attention is the primary runtime primitive.

### Runtime publication is part of the LoopBus refactor
The LoopBus change explicitly covers how runtime state, traces, and cycle-facing facts are published to client-sdk and WebUI.

Why: if publication stays implicit, frontend consumers will continue to depend on backend-private behavior.

### Frontend migration is scoped to LoopBus-facing surfaces
This change covers runtime-store and LoopBus/devtools inspection surfaces, but not terminal rendering or source-specific UI contracts.

Why: it keeps the frontend/backend boundary aligned with the runtime abstraction itself.

## Risks / Trade-offs

- [Split migration] -> separating runtime core from source adapters requires careful boundary definitions; specs must state that clearly.
- [Frontend drift] -> if runtime publication is underspecified, client-sdk/webui can regress; cover the contract explicitly in specs.
- [Incomplete rollout] -> adapters landing later means temporary coexistence; keep compatibility language explicit where needed.

## Migration Plan

1. Define the LoopBus core plugin/runtime specs.
2. Implement backend runtime primitives and deterministic hook execution.
3. Define and migrate runtime publication contracts used by client-sdk and WebUI.
4. Add backend + frontend regression coverage for LoopBus-facing state and inspection surfaces.
5. Hand off source-specific adapters and terminal control-plane work to follow-up changes.

## Dependencies and Handoff

**Inbound dependencies:** none. This is the base runtime change.

**Outbound handoff:**
- `integrate-message-terminal-attention-sources` consumes the plugin runtime and attention-first cycle gate defined here.
- `propagate-terminal-contract-to-clients` consumes the runtime publication contract defined here.
- `modernize-terminal-control-plane` may reuse the publication path but must not redefine LoopBus core semantics.

**Implementation boundary:**
- This change owns LoopBus runtime orchestration and publication only.
- It does not own message/terminal source semantics, terminal lifecycle APIs, or renderer transport.

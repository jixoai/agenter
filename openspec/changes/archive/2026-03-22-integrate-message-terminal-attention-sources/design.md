## Context

The original umbrella LoopBus change bundled message and terminal adaptation together with LoopBus core. That obscures an important architectural distinction: LoopBus defines orchestration, while message-system and terminal-system are first-party integrations that feed attention. They need a dedicated change because their migration rules, runtime behavior, and test coverage are different from both LoopBus core and the terminal control-plane expansion.

Existing building blocks:
- `MessageSystem` already has commit/diff semantics and channel metadata.
- `ManagedTerminal` already tracks semantic changes and focusable terminal instances.
- `AttentionEngine` persists committed attention facts.

The missing slice is a source-adapter change that formalizes how message-system and terminal-system feed LoopBus and how that path is tested.

## Goals / Non-Goals

**Goals:**
- Integrate message-system and terminal-system through the LoopBus attention-source adapter path.
- Ensure attention commits remain the gate before cycle start.
- Define the regression plan for adapter behavior across packages.
- Preserve a clean boundary between LoopBus core, source integrations, and terminal control-plane expansion.

**Non-Goals:**
- Expand terminal-system lifecycle/config/transport APIs in this change.
- Redefine the frontend runtime publication contract in this change.
- Introduce browser-system or os-system adapters yet.

## Decisions

### Message and terminal are first-party adapters
They use the same source adapter path that future systems will use, but their adapter logic is maintained as a dedicated first-party integration layer.

Why: this keeps the runtime architecture extensible without pretending source-specific behavior belongs inside LoopBus core.

### Attention commit remains the only cycle gate
Source adapters may invalidate and load drafts, but LoopBus only starts work after attention drafts are transformed and committed.

Why: this preserves the attention-first model and prevents sources from bypassing orchestration rules.

### Adapter testing is a first-class deliverable
This change explicitly includes a test strategy across app-server, message-system, and terminal-system.

Why: source integration bugs often appear at package boundaries, so the test plan should live with the integration change itself.

## Risks / Trade-offs

- [Boundary confusion] -> adapters can still leak core concerns unless the specs stay explicit about ownership.
- [Behavior drift] -> message and terminal semantics differ, so tests must cover each source independently.
- [Temporary duplication] -> transitional code may coexist with older paths briefly; remove or deprecate legacy paths deliberately.

## Migration Plan

1. Define attention-source adapter and regression-plan specs.
2. Integrate message-system invalidations through the adapter path.
3. Integrate focused terminal invalidations through the adapter path.
4. Add cross-package tests for message, focused terminal, and no-delta/no-cycle behavior.
5. Retire leftover source-specific shortcuts once the adapter path is verified.

## Dependencies and Handoff

**Inbound dependencies:**
- Depends on `refactor-loopbus-attention-runtime` for plugin runtime and attention-first cycle gating semantics.

**Outbound handoff:**
- `modernize-terminal-control-plane` builds on the focus/read semantics proven here.
- `propagate-terminal-contract-to-clients` may consume adapter-visible metadata, but should not redefine adapter behavior.

**Implementation boundary:**
- This change owns first-party source adapter behavior for message-system and terminal-system.
- It does not own terminal lifecycle/config/transport expansion or standalone renderer work.

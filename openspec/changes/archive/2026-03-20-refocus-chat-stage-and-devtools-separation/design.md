## Context

The current workspace shell already separates `Chat`, `Devtools`, and `Settings` as routes, but the Chat route still renders cycle metadata, collected-input summaries, and other LoopBus-oriented diagnostics in its primary reading flow. That makes the product hierarchy collapse: the workspace shell looks like multiple stacked dashboards, while the actual conversation and composer lose visual priority. The latest user review makes the target explicit: Chat must feel like the product, while Devtools remains available for expert inspection without leaking by default into the main conversation surface.

This change stays inside `packages/webui` and OpenSpec artifacts. It does not change session runtime semantics, LoopBus persistence, or server-side cycle generation. The change is primarily a projection and composition redesign: we keep the factual data, but move it to the correct surface and reduce duplicated passive status surfaces.

## Goals / Non-Goals

**Goals:**
- Make the workspace Chat route read as a conversation-first surface with one clear primary action and one clear route-relevant status summary.
- Move cycle-centric, collected-input, and kernel-centric inspection details into Devtools so Chat no longer defaults to internal debugging UI.
- Compact the workspace route chrome so workspace identity remains available without becoming a competing card above the conversation stage.
- Replace vague or stacked route status banners with a deterministic summary that always prefers one actionable truth.
- Lock the new hierarchy with Storybook DOM and unit coverage.

**Non-Goals:**
- No changes to LoopBus runtime behavior, session lifecycle state machine, or session DB schemas.
- No provider/model integration changes.
- No redesign of Quick Start or Workspaces beyond any shared shell primitives needed by this change.

## Decisions

### 1. Chat becomes a conversation projection, not a cycle inspector
The Chat route will still consume `RuntimeChatCycle[]`, but it will render them as a conversation-first stream. User messages, assistant replies, and tool-visible outputs remain factual, while cycle badges, collected-facts chips, and inspection metadata are removed from the default reading path.

Rationale:
- Chat is the product's primary surface; cycle internals are implementation context, not the main user task.
- We keep the existing cycle-backed data model and pagination, so the change stays projection-level instead of rewriting runtime contracts.

Alternatives considered:
- Keep cycle cards in Chat but collapse them by default: rejected because the mere presence of the card stack still frames Chat as a debugging surface.
- Remove cycle data entirely from the client: rejected because Devtools still needs it and the current API already projects it correctly.

### 2. Devtools owns cycle inspection explicitly
Devtools will become the single owner of technical inspection for a session. Cycle-oriented information such as collected facts, internal assistant channels, loopbus timing, terminal state, and model-call history will be reachable through Devtools tabs instead of being embedded into the Chat route.

Rationale:
- Expert information remains available without penalizing default usability.
- The route boundary becomes semantically correct: Chat for conversation, Devtools for diagnosis.

Alternatives considered:
- Keep a right-side inspector attached to Chat: rejected because it still couples the default chat experience to technical panels and makes mobile disclosure harder to reason about.

### 3. Route-level status resolves to one actionable summary
The workspace Chat route will derive a single status summary from session/runtime facts. For example, a stopped session with no running terminal should surface one recovery-oriented status message instead of stacking `AI stopped`, `Session stopped`, `No terminal`, and a generic error banner simultaneously.

Rationale:
- Users need one next step, not a dump of raw runtime facts.
- This fits the Apple-style information-architecture rule already recorded in `AGENTS.md`: passive status stays quiet, exceptions become dedicated notices, and one surface has one primary action.

Alternatives considered:
- Preserve all raw statuses but restyle them: rejected because the problem is semantic overload, not just visual styling.

### 4. Workspace identity becomes compact supporting chrome
`WorkspaceShellFrame` will keep workspace identity visible, but the top workspace section will shrink into a lighter context bar instead of a large card competing with the chat stage. The main visual emphasis shifts back to the conversation and composer.

Rationale:
- Workspace context is necessary but secondary.
- The current large card consumes valuable vertical space on both desktop and mobile before the user reaches the actual task.

Alternatives considered:
- Remove workspace context entirely from the route shell: rejected because users still need to know which workspace a session belongs to.

### 5. Unknown errors must be normalized before presentation
Generic fallback strings such as `Unknown error` will be treated as implementation leakage. The UI will normalize them into a deterministic route-level message with either a known recovery action or a neutral fallback such as "Something failed while preparing this session".

Rationale:
- Vague raw errors undermine trust and offer no recovery guidance.
- This can be solved entirely in the presentation/controller layer without inventing new backend protocols.

Alternatives considered:
- Show backend error strings verbatim everywhere: rejected because current backend fallbacks are not stable user-facing copy.

## Risks / Trade-offs

- [Risk] Moving cycle details out of Chat may reduce immediate visibility for expert users. → Mitigation: keep Devtools one tap away and make its cycle-oriented panels richer, not weaker.
- [Risk] Re-projecting cycle data into a flatter chat stream could introduce ordering regressions. → Mitigation: preserve the existing cycle/message ordering contract and add unit tests around conversation projection.
- [Risk] Status-summary collapsing could hide useful secondary context. → Mitigation: keep only the route-relevant conclusion in Chat and leave raw runtime detail available in Devtools.
- [Risk] Compacting workspace chrome could weaken route orientation on mobile. → Mitigation: retain the workspace name/path in a lightweight context row and keep bottom navigation unchanged.

## Migration Plan

1. Add the new delta specs for chat-first presentation and Devtools ownership.
2. Refactor Chat route composition and `ChatPanel` rendering so conversation becomes the default stream.
3. Refactor Devtools tabs/panels to absorb cycle/process inspection that is removed from Chat.
4. Compact workspace route chrome and introduce the route-level actionable status summary.
5. Update Storybook DOM tests, unit tests, and browser validation before closing the change.

Rollback is straightforward because the change only affects WebUI composition and projection. Reverting the route/panel changes restores the previous cycle-first presentation.

## Open Questions

- None. The product direction is already explicit: Chat is the primary stage, Devtools is the diagnostic surface.

## Why

The runtime currently lets source-specific systems leak interpretation, scheduling, and side effects into the shared attention/model surface. Message ingress is the most severe case: it infers reply obligations, serializes those guesses into prompt contracts, and can emit visible room acknowledgements without an explicit model action.

This change establishes a platform law that separates world facts, queryable projections, scheduler signals, and explicit effects so Message, Terminal, Skill, and future systems remain orthogonal atoms instead of source-specific branches inside `SessionRuntime`.
It removes hidden platform decisions and hidden side effects; it does not remove system-owned guidance, etiquette, or recommended playbooks when those remain ordinary model guidance rather than runtime-authored conclusions.

## What Changes

- **BREAKING** Remove platform-authored chat obligation inference such as `chatTurnState`, `chatObligationKind`, `settlesWhen`, `room_reply_pending`, `self_update`, `required_room_reply_sent`, and `no_external_reply_needed`.
- **BREAKING** Remove runtime auto-ACK behavior for cross-room message sends and tool work; room-visible messages must only come from explicit `message send`, `message edit`, or `message recall` actions.
- Add a shared four-channel runtime boundary law:
  - `WorldFact`: durable source facts that happened in the world.
  - `CapabilityProjection`: queryable views derived from facts, such as room snapshots, terminal snapshots, and skill indexes.
  - `SchedulerSignal`: focus, score, timer, idle, backoff, and similar orchestration facts that may wake or rank work but are not task semantics.
  - `AgentAction` / `EffectLedger`: explicit actions and their durable effects.
- Move room participants, presence, and visible room summaries out of eager message prompt envelopes and into explicit room snapshot/query surfaces.
- Rework the attention runtime kernel so it tracks AI-visible context snapshots, seeds `AttentionContext` views by focus state, chooses per focused context between serialized context and serialized committed attention items by cost, and governs `Notify` through a configurable quota contract.
- Make the above kernel work a first-class part of the same cleanup, not a side expansion: message pollution currently re-enters the model through bootstrap/injection law, so seeding, staged-item semantics, successful-injection accounting, and notify throttling must converge on the same current-state kernel contract.
- Keep attention context focus and scores as scheduler/debug metadata, not as source-authored semantic content or completion criteria.
- Reclassify terminal focus/unfocus/idle lifecycle events as scheduler signals; only terminal snapshots, diffs, and explicit command results may enter world-fact attention.
- Reclassify runtime skills as a capability index and on-demand content source; skill refresh may update the index and publish ordinary objective attention items, but must not create a dedicated skill-only task context by default.
- Replace message-specific `followUpAfterMs` etiquette with a generic one-shot watch/reminder primitive tied to explicit actions and objective fact predicates.
- Update runtime skill guidance and generated catalog text so it teaches explicit actions, queryable projections, domain etiquette, and recommended playbooks as non-binding guidance without encoding platform-authored social obligations or hidden side effects.
- Add BDD-style regression tests, documentation updates, and real runtime walkthrough requirements proving the platform no longer produces hidden semantic decisions or visible side effects.

## Capabilities

### New Capabilities
- `runtime-system-boundary-law`: Defines the four runtime integration channels, explicit effect ledger, generic watch/reminder primitive, and adapter obligations for keeping facts, projections, scheduling, and side effects separate.

### Modified Capabilities
- `attention-bootstrap-protocol`: Bootstrap-visible attention contexts must follow the same current-state kernel law as ordinary injection, and skill refresh must not create a default `ctx-skill-system` bootstrap context.
- `session-runtime-attention-message`: Chat-backed attention must carry raw room facts only, room output must require explicit message mutations, and platform-authored reply heuristics/auto-ACK behavior must be removed.
- `attention-runtime-kernel`: Attention bootstrap and interleaved attention injection must expose scheduler metadata only as routing/debug metadata, maintain AI-visible context snapshots, choose per focused context between context seed and committed attention items without serializing source-specific obligation judgments as model-visible truth, and enforce queryable notify quota rules.
- `runtime-system-kernel-adapters`: Adapters must classify emitted data as world fact, capability projection invalidation, scheduler signal, or explicit effect; source-specific lifecycle signals must not masquerade as task facts.
- `runtime-terminal-contract`: Terminal focus, unfocus, and idle-ready lifecycle observations must become scheduler signals, while terminal snapshots/diffs/command results remain the only terminal facts eligible for model reasoning.
- `runtime-skill-system-surface`: Runtime skill refresh must maintain a queryable capability index and optional ordinary objective attention items without becoming a dedicated skill-only task context by default.
- `runtime-builtin-skill-catalog`: Built-in runtime skill guidance must remove platform-authored social obligation language while still being allowed to describe domain etiquette and recommended action/query/watch playbooks as non-binding guidance.

## Impact

- Affected backend code:
  - `packages/app-server/src/session-runtime.ts`
  - `packages/app-server/src/agenter-ai.ts`
  - `packages/app-server/src/runtime-system-kernel-adapters/*`
  - `packages/app-server/src/runtime-tool-descriptors.ts`
  - `packages/app-server/src/runtime-skill-*`
  - `packages/app-server/src/generated/runtime-skill-catalog.generated.ts`
- Affected tests:
  - Message ingress / room mutation tests
  - Attention bootstrap tests
  - Terminal adapter tests
  - Runtime skill refresh / catalog tests
  - Real or integration runtime flows covering room messages, terminal work, skill refresh, and generic watches
- Affected durable contracts:
  - Attention context prompt/bootstrap shape
  - Attention runtime kernel snapshot and successful-injection semantics
  - Notify quota defaults and query surface
  - Message-backed attention metadata shape
  - Keyed staged attention-item semantics for interleaved injection
  - Runtime tool descriptor contract for delayed watches/reminders
  - Generated runtime skill catalog content
- Affected documentation:
  - `SPEC.md` and/or package-level specs for durable runtime law
  - `openspec/specs/*` capability contracts
  - Runtime skill source documents that generate the built-in catalog
  - Existing long-lived specs that currently conflict with this cleanup, including at least:
    - `openspec/specs/attention-bootstrap-protocol/spec.md`
    - `packages/app-server/SPEC.md`
    - any provider/delivery lifecycle specs that define acceptance semantics or bootstrap-visible attention inputs

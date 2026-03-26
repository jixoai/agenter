## Context

`packages/attention-system` already contains native `AttentionContext` and `AttentionItem` primitives, but the live runtime still runs through a LoopBus-first collection path that flattens attention back into generic text inputs. That keeps the kernel split across two models:
- attention owns the semantic state, but
- session-runtime, cycle persistence, Chat visibility, and side effects still depend on old `inputs / facts / reply` paths.

The user direction is explicit: break compatibility if needed, make attention the primary model, keep `LoopBus` only as an internal scheduler term, and make Chat visibility depend on message-system delivery instead of raw `attention-reply` publication.

## Goals / Non-Goals

**Goals:**
- Make attention the only semantic ingress for runtime work.
- Persist cycle history as attention-native frames with stable references.
- Route side effects through typed egress adapters, especially message-system and terminal-system.
- Enforce the boundary that Chat only renders successful message egress deliveries.
- Enforce that unresolved attention debt keeps driving model/tool work until the related score vectors are mutated toward completion.
- Leave room for future systems such as browser-system and os-system to integrate by the same adapter protocol.

**Non-Goals:**
- Finalize the OpenTelemetry trace shape; that belongs to `attention-trace-otel-vnext`.
- Redesign the WebUI information architecture; that belongs to `devtools-attention-first-vnext`.
- Deliver the future multi-chat-channel UX or flutter chat implementation in this change.

## Decisions

### Attention becomes the runtime truth, LoopBus becomes the scheduler shell
The runtime will keep a scheduler component internally, but every semantic step before and after model work is described in terms of attention contexts, attention items, cycle frames, and egress records.

Why: the current split forces every integration to translate back and forth between native attention state and legacy LoopBus message facts.

Alternative considered: keep the current LoopBus message abstraction and attach richer metadata. Rejected because it preserves the old architecture as the real source of truth.

### Source activity resolves into attention drafts, not flattened fallback text
Message channels, terminals, tasks, and future systems invalidate source refs. Source adapters read those refs and return structured attention drafts bound to contexts and owners.

Why: future extensibility depends on protocol-level integration, not on session-runtime private queues.

Alternative considered: keep per-system bespoke queues and only convert to attention at the model boundary. Rejected because it keeps the kernel fragmented.

### Cycle persistence moves to attention-native frames
A cycle frame records the attention refs that caused the work, the model-call refs created during the work, and the egress refs emitted by the work. It stops duplicating large `inputs / facts / reply` blobs.

Why: Devtools and trace need stable references that survive runtime teardown and allow later reconstruction.

Alternative considered: keep old cycle payloads and append attention metadata. Rejected because it preserves duplicate truth and noisy frontend transforms.

### Message visibility depends on message egress success
A committed attention item becomes visible in Chat only if a message egress adapter claims it and dispatches it successfully into a chat channel. Internal attention items remain technical facts.

Why: the current `attention-reply` leakage is an architecture bug, not a rendering bug.

Alternative considered: let Chat filter `attention-reply` heuristically on the frontend. Rejected because delivery semantics belong to the runtime boundary.

### Attention debt remains an active runtime obligation
If one or more attention items still have `score >= 1`, the runtime keeps self-waking and the model round is not treated as meaningful progress unless it mutates attention state or triggers an explicit external action that leads to later attention mutation.

Why: the current runtime can self-wake, but a plain-text or no-op model round still leaves the impression of completion even though the semantic state is unresolved.

Alternative considered: rely on prompt wording alone. Rejected because this is a kernel law; prompt guidance helps, but runtime semantics must still reject false completion.

### Breaking migration is acceptable for the runtime data model
This change will treat old cycle payloads and old attention-to-chat wiring as legacy. New code writes only attention-native records and uses the new egress boundary.

Why: the target architecture is clearer than trying to maintain two parallel models.

Alternative considered: dual-write old and new cycle formats temporarily. Rejected because it adds complexity to a kernel refactor without helping the final architecture.

## Risks / Trade-offs

- [Runtime refactor touches many modules] -> Mitigation: land the change behind narrow record and adapter boundaries, then move consumers one surface at a time.
- [Cycle history schema changes are breaking] -> Mitigation: treat vNext runtime history as a new canonical format and keep migration logic limited to explicit tooling if it is later needed.
- [Egress matching bugs could hide replies] -> Mitigation: persist egress attempts and outcomes so failures are inspectable and testable.
- [Cross-context scheduling can become hard to reason about] -> Mitigation: keep cycle-frame references explicit and pair this change with the trace refactor.

## Migration Plan

1. Replace the current session-runtime collection path with source invalidation -> attention draft -> attention commit.
2. Introduce new cycle-frame and egress record shapes in runtime persistence and publication.
3. Move message-system and terminal-system integration onto typed egress adapters.
4. Remove direct Chat publication from raw attention replies.
5. Enforce unresolved-attention self-drive semantics and reject false completion from plain-text/no-op rounds.
6. Update runtime consumers and tests to read attention-native records only.

## Open Questions

- Whether cycle-frame persistence should be kept in the existing tables with a new payload schema or promoted into new attention-native tables.
- Whether message egress should support fan-out to multiple chat channels in one commit or require one committed item per outbound delivery.

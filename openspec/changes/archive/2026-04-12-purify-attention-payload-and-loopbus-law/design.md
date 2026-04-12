## Context

The current backend already moved toward attention-first runtime behavior, but three different truths are still partially collapsed into one path:

- durable attention facts
- model-facing prompt projection
- transport / scheduler metadata

That collapse causes two failures:

1. systems lose AI-visible detail when attention payloads are simplified, because the missing detail was never promoted into durable body content;
2. LoopBus and source adapters retain an “open slot” mindset where arbitrary metadata can be smuggled through internal envelopes.

This change keeps the recent attention simplification, but finishes the law correction so systems enrich the right layer instead of reintroducing metadata sprawl.

## Goals / Non-Goals

**Goals**

- Keep attention durable facts as the single model-facing truth.
- Let systems contribute richer AI-readable body content without reopening generic metadata escape hatches.
- Make routing intent typed and explicit.
- Keep LoopBus focused on scheduling and protocol bookkeeping.
- Cover the new contracts with backend tests and frontend integration notes.

**Non-Goals**

- Do not redesign workspace ownership, avatar runtime identity, or notification projection again.
- Do not make LoopBus source refs fully system-specific tagged unions in this change if that would block delivery; only remove open payload abuse from the current contracts.
- Do not implement WebUI production changes.

## Decisions

### 1. Separate provenance, body, and egress into different contracts

An attention commit now has three distinct semantic planes:

- **provenance metadata**: who/what produced the commit
- **body**: the actual AI-readable summary and detail already represented by `summary + change`
- **egress**: typed routing intent for external adapters

`meta` SHALL remain provenance-only. It SHALL NOT carry reply targets, quick actions, private storage blobs, or AI-required context.

Why:

- provenance is durable fact;
- body is what the model must read;
- egress is operational intent.

They have different lifecycles and should not share one bag.

### 2. AI-visible richness belongs in system-authored body builders

Each source adapter SHALL derive model-facing body content from its own authority:

- message: room/channel social envelope + visible message body + attachment facts
- terminal: typed snapshot/diff summary + tail/diff body
- task: task summary/source excerpt/checkpoint body
- future systems: their own authoritative presentation builder

This content SHALL be written into the attention commit body through typed draft presentation fields. The model must not depend on hidden transport metadata for understanding.

### 3. Source draft contracts become typed, not open

The runtime ingestion path SHALL replace open draft metadata with typed draft fields:

- provenance overrides
- presentation summary/body/format/kind
- semantic identity hints used for dedupe / score seeds
- typed egress descriptors

Source lookup hints may still exist for adapter-internal addressing, but they are not AI truth and must not be copied blindly into commits or prompt payloads.

### 4. LoopBus metadata is scheduler-only

`LoopBusMessage.meta` remains allowed only for scheduler/protocol facts such as:

- compact / exclusive-cycle flags
- persisted provenance refs (`attentionContextIds`, `attentionCommitRefs`)
- wake/debug bookkeeping required for persistence and inspection

System-private state and AI-relevant content SHALL be projected into the message body or queried from typed tools instead.

### 5. Prompt payloads stop serializing raw metadata bags

Attention bootstrap and delta payloads SHALL serialize:

- provenance fields explicitly
- scores
- summary
- body/change
- typed egress descriptors when present

They SHALL NOT dump a raw `meta` object into the model payload. This keeps tokens focused and removes ambiguity about what the AI is expected to use.

## Risks / Trade-offs

- Some existing tests currently assert `meta.replyTarget` or generic metadata visibility.
  Mitigation: migrate them to typed egress assertions.
- A few runtime internals still use `LoopSourceRef.meta` as a lookup cache.
  Mitigation: keep minimal lookup hints for now, but prevent those hints from leaking into commits or prompt payloads.
- Systems may initially miss detail after the generic `meta` dump is removed.
  Mitigation: add explicit body builders and regression tests per source type.

## Migration Plan

1. Update OpenSpec requirements for attention payload/body/egress separation.
2. Refactor attention core types to close provenance metadata and add typed egress descriptors.
3. Refactor session-runtime source draft generation to use typed presentation/provenance fields.
4. Refactor bootstrap/item serialization to emit explicit fields instead of raw metadata dumps.
5. Update message egress hooks and related tests.
6. Sync durable specs and add `.chat` integration notes for frontend follow-up.

Rollback strategy:

- none planned; this is a deliberate law correction.

## Open Questions

- Quick-action notification affordances may later need a typed push-action descriptor alongside egress descriptors, but this change only establishes the separation and handles current message reply routing.

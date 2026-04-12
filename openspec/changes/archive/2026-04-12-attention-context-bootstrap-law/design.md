## Context

The backend prompt boundary has already been corrected in code:

- `AgentToolProvider` no longer contributes `buildSystemPromptSection`
- `SYSTEMS_GUIDE` is now an empty slot rather than a provider-owned extension surface
- LoopBus plugin runtime now exposes `AttentionContextGuideProvider`
- builtin message / terminal guides and lightweight task / workspace guides are already registered from runtime-side plugins
- `collectAttentionInputs()` already emits bootstrap `context` first and delta `items` second
- `persistCycle()` already records `attentionContextIds` and `attentionCommitRefs`
- current tests already prove clean `systemPrompt` plus the new bootstrap shape

The durable spec, however, still describes the old architecture where active tool providers inject dynamic system guidance into `systemPrompt`. That is now the wrong platform law.

This change therefore does two things:

1. aligns OpenSpec with the already-landed runtime law;
2. records the remaining hardening work so future changes do not regress back into prompt glue.

## Goals / Non-Goals

**Goals**

- Make `attention-system` the sole prompt-side durable truth for runtime bootstrap.
- Define bootstrap as a two-stage protocol: one `context` document plus delta `items`.
- Define the ownership boundary: global prompt law stays in `systemPrompt`; dynamic system help belongs to attention bootstrap.
- Keep the extension path orthogonal: future systems add guide providers, not provider-owned prompt sections.
- Record the cycle persistence refs needed for inspection, replay, and compaction audits.

**Non-Goals**

- Do not reintroduce compatibility glue for old provider-owned `systemPrompt` sections.
- Do not redesign attention scoring, notification projection, or room/terminal/workspace mounts in this change.
- Do not decide the final wording of every system guide paragraph; this change defines structure and ownership, not prose style polish.

## Decisions

### 1. `systemPrompt` stays pure and provider-agnostic

`systemPrompt` now owns only stable global prompt law plus avatar identity slots. Dynamic system help from message/terminal/task/workspace no longer belongs there.

Alternative considered:
- keep `SYSTEMS_GUIDE` as a provider-owned fallback surface.

Why not:
- that keeps `app-server` coupled to arbitrary provider/tool glue and makes prompt pollution depend on registered providers rather than active runtime facts.

### 2. Dynamic system help belongs to attention bootstrap

The first attention input for a round is a bootstrap `context` document. It explains which systems are active for the round, how to interpret their contexts, and then presents grouped attention-context facts.

The bootstrap document uses this layering:

- `## PreAICallContext Summary`
- `## Systems Descriptions`
- `## Attention Context`

One-line system descriptions are lightweight activation markers. Long guides stay grouped under each system’s attention-context section.

Alternative considered:
- continue mixing system help into provider prompt sections or item payloads.

Why not:
- that collapses stable law, system guidance, and delta facts into one layer and destroys single-source-of-truth boundaries.

### 3. Bootstrap and delta stay separate, but item wire shape is not a platform law

`context` is not a room-local dump. It is the bootstrap document for the whole AI call. `items` remain delta-only and include only unresolved attention facts.

The important law is semantic layering:

- `context` explains the round
- `items` carry unresolved delta facts

The exact wire shape of `items` is intentionally flexible for now. Repeated `yaml+attention-item` blocks are acceptable, and a single aggregated `yaml+attention_items` block is also acceptable, as long as the payload remains delta-only and does not reintroduce pre-baked associated-query dumps.

Alternative considered:
- make split `yaml+attention-item` blocks a new hard platform law.

Why not:
- that would turn a serialization preference into architecture. Right now there is no demonstrated product advantage large enough to justify more migration work.

### 4. Active-guide resolution is the only extension path

Dynamic system guidance must be resolved through `AttentionContextGuideProvider` and the LoopBus plugin runtime hooks. Future systems extend bootstrap by registering guide providers, not by patching `agenter-ai`.

Alternative considered:
- add more provider-owned prompt hooks for each new system.

Why not:
- that would recreate the exact cross-module glue this law is trying to remove.

### 5. Cycle persistence keeps bootstrap/delta provenance

Cycle persistence must keep `attentionContextIds` and `attentionCommitRefs` from collected inputs so later inspection can reconstruct which contexts and commits were involved in a round.

Alternative considered:
- treat bootstrap shape as transient request-only data.

Why not:
- replay, compact audit, and debugging then lose the ability to tell which attention contexts and unresolved commits drove the cycle.

## Risks / Trade-offs

- [Guide activation may still drift] → keep the spec focused on active-guide resolution and add remaining tests for inactive-system omission.
- [Compact/replay may still carry old protocol residue] → record that audit as a remaining task instead of pretending the migration is finished.
- [Message-system guide carries reply-structure law as well as system help] → keep the structure boundary explicit so behavioral guidance lives in bootstrap under the active system rather than leaking back into global prompt law.

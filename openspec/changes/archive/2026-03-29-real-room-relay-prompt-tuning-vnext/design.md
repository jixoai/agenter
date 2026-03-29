## Context

The repository now has two complementary acceptance paths for LoopBus chat behavior:

1. A deterministic local-provider regression that proves the kernel/runtime path for two-room relay and manual compact.
2. A real-provider regression that exercises the same path against the actual system prompt, tool descriptions, and provider behavior.

Real-provider evidence shows two concrete failures:

- A minimal single-room task can emit the visible reply (`REAL-AI-OK`) but still leave the originating attention unresolved.
- A two-room relay can discover the `gaubee` room and dispatch the relay prompt there, but may still stop before sending the final answer back to `chat-main`.

This means the current platform rules are still underspecified for real models: they do not strongly encode that chat-backed work remains unfinished until visible egress and attention settlement both happen, and that cross-room relay is unfinished until the originating room receives the final answer.

## Goals / Non-Goals

**Goals:**

- Make the prompt/tool contract explicit enough that a real model closes a minimal chat-backed task by both dispatching the visible reply and settling the related attention.
- Make cross-room relay explicit enough that the model treats `secondary room reply -> original room answer -> attention settle` as one required round trip.
- Extend real-provider regression coverage to manual `/compact` followed by `中午吃什么`, proving the compact summary preserves the factual answer instead of forcing a second relay.
- Preserve the existing LoopBus/message-system architecture and use real tool protocols instead of adding special-case room glue.

**Non-Goals:**

- No GUI or WebUI work in this change.
- No vendor-specific branching or per-model hardcoded room logic.
- No new room abstraction beyond message-system channels.

## Decisions

### Strengthen the platform contract in prompts and tool descriptions before changing runtime behavior

The first intervention should be the shared system prompt and runtime tool descriptions, because the user explicitly wants real AI validation of prompt/tool design. The contract must state:

- visible chat dispatch does not by itself finish attention-backed work
- the model must explicitly settle the related attention after replying
- named-person relay requires channel discovery first
- once a relay answer is available, the next required action is to answer back in the originating room before declaring completion

Alternative considered:
- Auto-synthesize settlement or backfill the original room from runtime heuristics. Rejected as the primary fix because it hides a prompt/tool contract bug behind platform glue.

### Keep runtime containment as a guardrail, not the main business path

The existing `attention.no_progress` / `attention.missing_message_dispatch` handling is valuable because it prevents false completion from leaking into the durable state. We should keep using that containment path to surface real-provider failures, while tuning the contract so ordinary success no longer depends on retries or compact fallback.

Alternative considered:
- Loosen containment so partial visible replies count as success. Rejected because it would normalize protocol violations and make compact/follow-up behavior unreliable.

### Reuse the real kernel harness and extend it with post-compact follow-up assertions

The real harness already boots a full `AppKernel` session with user settings-derived provider configuration. The smallest orthogonal extension is to add scenario helpers that:

- verify the model call eventually completes
- inspect durable chat / attention / model-call facts when it does not converge
- add the `/compact` follow-up case after the initial relay succeeds

Alternative considered:
- Replace the real-provider regression with more mock coverage. Rejected because the open question is specifically about prompt/tool behavior under a real provider.

## Risks / Trade-offs

- [Risk] Real-provider behavior remains non-deterministic even after prompt tuning. → Mitigation: keep assertions focused on durable facts (`chatMessages`, attention state, model-call trace, cycle projection) and capture failures as protocol evidence.
- [Risk] Prompt wording grows into a brittle checklist that harms general behavior. → Mitigation: encode only platform laws (discover rooms, dispatch visible reply, settle attention, round-trip relay ownership) and avoid sample-specific prose.
- [Risk] Runtime still needs a small rule adjustment after prompt tuning. → Mitigation: restrict runtime changes to generic containment/protocol edges, never to `gaubee`/room-specific hacks.

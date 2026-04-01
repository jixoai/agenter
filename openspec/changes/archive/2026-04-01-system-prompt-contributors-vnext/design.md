## Context

The architecture intent is now clear:

- The kernel is attention-first and should stay ignorant of system-specific behavior beyond stable protocols.
- `terminal`, `message`, and `task` are orthogonal systems that each know their own semantics.
- The model should learn those semantics through `systemPrompt`, not through fake runtime messages, hidden attention commits, or hardcoded branches inside `AgenterAI`.

The existing implementation violates that direction in two ways.

1. `AgenterAI.send()` only knows how to stitch together a fixed set of shared prompt documents. There is no platform rule for a provider to contribute its own prompt section, so system meaning either leaks into the global prompt or is not expressed at all.
2. Compact `readyReplies` are derived with a global per-chat trigger map. When the same chat later discusses another topic, earlier replies can be mislabeled and reused for the wrong follow-up.

## Goals / Non-Goals

**Goals**

- Keep the kernel generic: it assembles provider-owned prompt sections but does not hardcode terminal/message/task semantics.
- Keep the systems orthogonal: each provider describes its own meaning and usage.
- Keep prompt injection inside `systemPrompt`, not inside user chat history or synthetic runtime help messages.
- Preserve legacy custom templates that do not yet declare `<Slot name="SYSTEMS_GUIDE" />`.
- Make compact ready replies provenance-safe across multiple topics in the same channel.

**Non-Goals**

- No new runtime help-message channel.
- No new attention hook that commits “tool help” atoms.
- No projection-layer redesign.
- No attempt to make prompt semantics configurable per terminal preset in this change.

## Decisions

### Add an optional provider-owned `systemPrompt` section contract

`AgentToolProvider` will gain an optional method that returns a markdown section for the model `systemPrompt`. `AgenterAI` will call that method for active providers, normalize the results, and inject them into a dedicated `SYSTEMS_GUIDE` slot.

Why:

- It keeps `AgenterAI` focused on prompt assembly instead of system semantics.
- It lets future systems extend model understanding without editing the kernel prompt bundle.

Alternative considered:

- Keep adding terminal/message/task prose to the shared global prompt docs. Rejected because it recentralizes orthogonal system meaning inside the kernel prompt bundle.

### Use template slot injection with a legacy fallback

The canonical path is `<Slot name="SYSTEMS_GUIDE" />` inside `SYSTEM_TEMPLATE.mdx`. For existing custom templates that do not yet have that slot, `AgenterAI` will fold the generated system-guide text into the `AGENTER_SYSTEM` slot content so the guidance still reaches the model.

Why:

- It upgrades the platform rule without silently breaking existing local prompt templates.
- It avoids inventing a separate migration path just to expose one new slot.

Alternative considered:

- Require every custom template to be manually upgraded before the feature works. Rejected because it makes the new platform rule too fragile in existing real sessions.

### Let each provider own only its own semantics

The runtime will add concise multilingual sections for:

- `terminal`: terminal as the operating-system workbench; external facts should be fetched or verified through terminal tools instead of hallucinated.
- `message`: message-system as an asynchronous multi-channel communication fabric; relay is role-aware communication, not raw quote forwarding.
- `task`: task-system as a durable obligation ledger; tasks track work, blockers, and triggers rather than acting as a reply surface.

Why:

- This matches the architecture rule that atoms own their own laws.
- It avoids duplicating one system’s semantics inside another system’s provider or inside the kernel.

### Derive `readyReplies` sequentially from prompt-window provenance

Compact derivation will scan the prompt window in order, update the latest trigger phrases for each focused channel when new attention evidence appears, and bind each `message_send` to the latest phrases known at that point in the history.

Why:

- It preserves local provenance for each dispatched reply.
- It fixes the cross-topic contamination bug without inventing extra persisted metadata.

Alternative considered:

- Persist a second special fact alongside every `message_send` to record trigger phrases. Rejected for now because the sequential prompt-window evidence is already available and sufficient.

## Risks / Trade-offs

- Prompt wording can still be imperfect for some models. Mitigation: keep the sections focused on platform laws, not vendor-specific heuristics.
- Legacy custom templates might format the injected guide differently when the fallback path is used. Mitigation: keep the fallback insertion near `AGENTER_SYSTEM` and cover it with a unit test.
- Sequential ready-reply derivation assumes prompt-window ordering remains chronological. Mitigation: that ordering is already a core prompt-window invariant and should stay explicit.

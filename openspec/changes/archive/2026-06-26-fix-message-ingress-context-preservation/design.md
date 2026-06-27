## Context

The attention kernel currently treats every `AttentionCommit.change` as both immutable item detail and mutable context update. That is too broad for message ingress. A room user message is an objective world fact that should become an attention item with scores, but the room `attentionContext` is the Avatar's own rolling topic summary. Letting message ingress overwrite that summary turns the transcript projection into the cognitive context itself.

## Goals / Non-Goals

**Goals:**
- Preserve room message facts as active attention items and immutable commit history.
- Prevent message-system ingress from changing `attentionContext.content`, slots, or content format.
- Keep Avatar-authored attention commits able to update context normally.
- Make the boundary explicit in code comments and OpenSpec.

**Non-Goals:**
- Do not remove `AttentionCommit.change`; it remains the item/detail payload and historical record.
- Do not change room transcript storage or read/unread behavior.
- Do not forbid other systems from using context-preserving commits when they need the same law later.

## Decisions

### Decision 1: Add context mutation intent to the attention kernel

`AttentionCommitInput` gets a `contextMutation` flag with compatible default `apply`. When set to `preserve`, the commit is stored with its original `change`, scores are merged, and head advances, but `applyAttentionChange` is not run. This separates item/detail truth from context-summary mutation without inventing a second commit type.

Alternative considered: force message ingress to write `change: { type: "update", value: existingContext }`. Rejected because it would either lose the room-message detail from the attention item or preserve it only through side-channel metadata.

### Decision 2: Message ingress declares `preserve`

The message source adapter will mark message attention drafts as context-preserving. The generic draft-to-commit path passes that intent into `AttentionCommitInput`; the attention kernel enforces the semantic boundary.

Alternative considered: branch inside `commitAttentionDraft` on `source === "message"`. Rejected because that hides a platform law inside source-specific runtime glue.

### Decision 3: Avatar attention commits still update context

Direct `attention commit` and model-produced attention updates keep default `apply` behavior. After processing a room message, the Avatar can update scores and repair the topic summary explicitly through its own attention commit.

## Risks / Trade-offs

- [Risk] Existing tests or projections may assume context content equals the last message fact. -> Mitigation: update the behavior spec and focused BDD test to assert item/detail remains available while context content is preserved.
- [Risk] Persisted snapshots without `contextMutation` must remain readable. -> Mitigation: default missing value to `apply` and only emit `preserve` for new commits that need it.

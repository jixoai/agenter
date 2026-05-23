## Why

Room message ingress currently commits an attention item and rewrites the room attention context with the raw message fact in the same operation. That corrupts the meaning of `attentionContext`: in message-backed rooms it is the Avatar-owned topic summary, not a transcript mirror that every user message may overwrite.

## What Changes

- Add an explicit attention commit context-mutation intent so commits can preserve context while still carrying immutable item/detail and score updates.
- Mark message-system ingress drafts as context-preserving facts: user room messages create attention item/scores/history, but do not rewrite `attentionContext`.
- Keep Avatar-authored attention commits free to update scores and repair/rewrite `attentionContext` after it processes the message.
- Add BDD coverage proving user room messages preserve an existing Avatar topic summary while remaining queryable as active attention items.

## Capabilities

### New Capabilities

### Modified Capabilities
- `attention-context-state`: attention commits can preserve current context content while still advancing commit history and score state.
- `session-runtime-attention-message`: message-backed room ingress records pure attention facts without rewriting the room attention context.

## Impact

- Affected code: `packages/attention-system`, `packages/app-server/src/session-runtime.ts`, and focused attention/message tests.
- Affected contracts: `AttentionCommitInput` gains a context mutation intent; default behavior stays compatible for non-message commits.
- Affected runtime behavior: unread room messages still wake and score attention, but `attentionContext.content` remains Avatar-authored until an explicit Avatar attention commit updates it.

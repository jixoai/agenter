## Context

Only one external system currently needs automatic extraction from attention commits: message-system. Humans converse through surface summaries, so a commit summary can be promoted into a channel message when objective context binding exists. Terminal does not need the same automation; explicit terminal tools are enough.

## Goals / Non-Goals

**Goals**
- Make message automation a small hook, not a generic dispatch framework.
- Keep direct `message_send` available to the AI.
- Return hook execution results from `attention_commit`.
- Remove terminal auto side effects from attention commits.

**Non-Goals**
- Add more hook-specific metadata that increases AI burden.
- Infer hidden transactional rollback semantics on hook failure.
- Rebuild the full chat-channel product surface.

## Decisions

### Replace generic egress with commit hooks
`attentionCommitted` hooks become result-producing hooks.

Why: only message uses this path automatically, so generic dispatch is unnecessary abstraction.

### Message hook extracts from summary plus channel binding
The message hook sends when:
- the context is bound to a message channel
- the commit author is the current avatar / owner
- `summary` is non-empty

The sent content is `commit.summary`.

Why: summaries are the human-facing layer; `change` is internal context maintenance.

### Direct `message_send` remains available
The AI can always call `message_send({ chatId, content, rootId?, to? })`.

Why: when hooks cannot infer enough or fail, the path should stay explicit and simple.

### Terminal auto dispatch is removed
No terminal hook consumes commits.

Why: terminal actions should remain explicit tool calls.

## Risks / Trade-offs

- Hook extraction may be conservative -> acceptable, because `message_send` covers the explicit path.
- Hook results add more structured output -> acceptable, because they remove hidden behavior and retries.

## Migration Plan

1. Remove registerEgress/dispatchCommittedAttention from the plugin runtime.
2. Upgrade committed hooks to return structured results.
3. Implement message hook + `message_send` tool.
4. Remove terminal auto dispatch logic and update tests/UI publication.

## Context

`attention_query` currently defaults to `includeInactive = true`, which returns `score=0` rows. `attention_reply` currently writes a preview into `activeCycle.streaming.content`, so Chat treats an internal attention-system update as a user-visible assistant reply. Separately, optimistic chat dedupe still relies on timestamp windows even though `clientMessageId` already exists end to end.

## Goals / Non-Goals

**Goals:**
- Make Chat user-facing again.
- Make attention query defaults exclude inactive rows.
- Replace heuristic dedupe with identity-based dedupe.
- Remove internal attention reply leakage from streaming cycles.

**Non-Goals:**
- Preserve backward compatibility for old attention tool names.
- Redesign the entire attention schema beyond query/update semantics.
- Rework cycle inspector presentation in this change.

## Decisions

### `attention_reply` is replaced, not hidden
The tool contract becomes `attention_update`, with semantics centered on internal attention facts and relationships rather than user-visible reply text.

Why: the user explicitly allowed a non-backward-compatible redesign, and the old name encodes the wrong product meaning.

### `attention_query` defaults to `minScore = 1`
Queries exclude `score=0` rows unless the caller explicitly sets `minScore: 0`.

Why: score zero represents inactive attention and should not appear in normal query flows.

### Chat dedupe is identity-based
Optimistic and persisted chat cycles deduplicate through `clientMessageId` and cycle identity, not time-window guessing.

Why: the data model already carries stable ids, so continued heuristic matching is both weaker and unnecessary.

### Internal attention updates never write to Chat streaming content
Only `to_user` assistant output can populate user-facing streaming content.

Why: Chat must remain a user surface, while attention activity belongs in internal/inspection views.

## Risks / Trade-offs

- [Prompt drift] -> prompts/tool docs that still refer to `attention_reply` must be updated together.
- [Migration churn] -> tests and fixtures that assumed internal attention text in Chat need to be rewritten.
- [Partial identity data] -> dedupe must handle older cycles that lack `clientMessageId` without breaking current transcripts.

## Migration Plan

1. Change attention-system query input to use `minScore` semantics.
2. Replace `attention_reply` with `attention_update` in app-server tools and prompts.
3. Remove internal attention preview injection from session runtime streaming.
4. Upgrade Chat projection to dedupe by `clientMessageId` first, with narrow fallback only for legacy data.
5. Add backend and WebUI regression coverage.

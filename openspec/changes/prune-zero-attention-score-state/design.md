## Context

`AttentionCommit.scores` and `AttentionContext.scoreMap` currently reuse the same normalized score representation, so a resolving patch such as `{ hash1: 0 }` is persisted in history and also retained indefinitely in the current context projection. That is convenient for some tests, but it violates the stronger law we want: commit history is the immutable ledger, while context state is only the latest unresolved projection.

The runtime already depends on explicit zero-valued ledger patches for `done=true`, and history queries already expose resolved facts through widened filters such as `minscore:0`. The design goal is therefore not to remove zero-valued score patches from the system, but to stop leaking them into the current-state snapshot.

## Goals / Non-Goals

**Goals:**

- Make `AttentionContext.scoreMap` a pure unresolved-state projection
- Preserve zero-valued score patches in immutable commit history
- Keep `done=true`, `minscore:0`, and score-hash history traversal behavior intact

**Non-Goals:**

- Redesigning attention query syntax or search ranking
- Replacing `done=true` with a different settlement primitive
- Removing historical visibility of resolved score patches

## Decisions

### 1. Prune resolved keys from `AttentionContext.scoreMap`

Any state-construction or state-update path that materializes `AttentionContext.scoreMap` will drop keys whose normalized score is `<= 0`.

Rationale:

- `scoreMap` is the current-state projection, not the historical ledger
- Callers that care about unresolved work should not need to special-case zero residues

Alternative considered:

- Keep zero keys and require every consumer to interpret `0` as “resolved”
  - Rejected because it keeps history residue inside the mutable state surface and spreads ambiguity outward

### 2. Preserve zero-valued entries in `AttentionCommit.scores`

The immutable commit ledger will continue to store explicit `{ key: 0 }` patches, including `done=true` resolution commits.

Rationale:

- A zero-valued patch is an objective settlement fact: it records that a specific score key was cleared at a specific commit boundary
- `minscore:0` and hash-linked history queries rely on that fact remaining queryable

Alternative considered:

- Encode resolution through deletion or meta flags instead of `0`
  - Rejected because it would be a broader protocol change and would weaken the existing “done resolves active keys to zero” contract

### 3. Treat missing current-state keys as the resolved projection

Runtime snapshots, tests, and helper code that currently expect `scoreMap[key] === 0` will be updated to treat the missing key as the canonical resolved current state.

Rationale:

- This is the smallest surface change consistent with the new projection law
- It preserves ledger truth without keeping redundant zeros in state

Alternative considered:

- Keep a second resolved-score map in state
  - Rejected because it duplicates ledger truth and reintroduces the same coupling under a different name

## Risks / Trade-offs

- [Risk] Existing callers may implicitly depend on `scoreMap[key] === 0`.  
  → Mitigation: update targeted tests and snapshot expectations to treat absence as resolved current state.

- [Risk] Query or replay paths might accidentally start depending on pruned state instead of ledger patches.  
  → Mitigation: keep zero-valued `commit.scores` untouched and add regression tests around `done=true` and `minscore:0`.

- [Risk] This is a breaking snapshot-shape change for direct consumers of `AttentionContext.scoreMap`.  
  → Mitigation: capture it explicitly in proposal/specs and keep the blast radius limited to attention-state consumers.

## Migration Plan

1. Update durable specs to distinguish current-state projection from immutable ledger truth.
2. Change attention-state construction and mutation code to prune zero-valued keys from `scoreMap`.
3. Update runtime/tests that assert raw zero-valued current-state keys.
4. Verify that `done=true` still emits zero-valued ledger patches and that widened history queries still surface them.

## Open Questions

- None for this iteration.

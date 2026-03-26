## Context

The repository currently loads both user and project settings, but `ai.activeProvider` is treated like any other deep-merged scalar. That means a checked-in project default can silently override the user's real provider choice. In practice this causes sessions to keep using `default/deepseek` even when the user has configured `activeProvider = kimi` globally.

At the same time, unresolved attention debt is modeled correctly in `scoreMap`, but operationally the product can still look as if it simply stopped. Containment is a scheduler fact, not semantic resolution, so the runtime and UI must keep that distinction explicit.

## Goals / Non-Goals

**Goals:**
- Preserve user/provider intent across settings layers.
- Keep unresolved score debt explicit even when containment is active.
- Make provider/config failure diagnosable through runtime state and tests.

**Non-Goals:**
- Rebuild the entire settings source system.
- Remove containment/backoff mechanics.
- Introduce backward-compatible aliases for the old silent fallback behavior.

## Decisions

### `ai.activeProvider` is user-owned selection state
Settings merge keeps provider catalogs deep-merged, but active provider selection is resolved with this precedence:
- `local.ai.activeProvider`
- `user.ai.activeProvider`
- `project.ai.activeProvider`
- builtin default

Why: provider choice is an operator preference, while project settings contribute provider definitions and defaults.

### Project provider catalogs remain mergeable
`ai.providers` continues to deep-merge across layers, so project settings can define repo-local defaults or helper providers without erasing user-defined providers.

Why: provider catalog composition is useful; silent replacement of the user's active provider is not.

### Containment never means semantic completion
If `scoreMap` still contains entries `>= 1`, the runtime remains in unresolved obligation. Containment may classify the obligation as `ready`, `backoff`, or `blocked`, but it does not zero the score and must not be presented as successful completion.

Why: unresolved work is an attention fact. Scheduler containment is merely the current operational posture.

### Provider/config failure must be observable
If the resolved provider cannot actually run (missing key, wrong provider, incompatible setup), the runtime must publish enough state for Devtools/tests to explain why unresolved attention did not progress.

Why: otherwise non-zero scores look like a broken scheduler instead of a diagnosable configuration/runtime problem.

## Risks / Trade-offs

- Special-casing `ai.activeProvider` makes merge semantics less uniform -> mitigate by documenting it as selection-state, not catalog-state.
- Existing projects that relied on project-level override of `activeProvider` will change behavior -> acceptable breaking change; local settings remains the explicit override path.
- More explicit blocked/backoff state can surface previously hidden misconfiguration -> desired, but update tests and UI expectations accordingly.

## Migration Plan

1. Resolve settings layers separately enough to compute user-owned `ai.activeProvider` precedence.
2. Update session config resolution/tests so a global provider selection wins over checked-in project defaults.
3. Add runtime regression coverage for unresolved debt with provider failure vs solvable real-provider progress.
4. Keep runtime publication explicit about `ready/backoff/blocked` while non-zero scores remain.

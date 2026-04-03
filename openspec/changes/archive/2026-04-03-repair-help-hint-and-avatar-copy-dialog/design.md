## Context

`HelpHint` was migrated into a Lit atom with persistent first-visit onboarding baked into the default behavior. That makes every hint open itself on first paint, which is mathematically the wrong default for a disclosure primitive: the quiet state should be the baseline, and onboarding should be opt-in.

The `Workspaces` avatar copy dialog also regressed into an action button with inline async logic instead of a proper form boundary. That weakens both accessibility and interaction stability.

## Goals / Non-Goals

**Goals**

- Restore `HelpHint` to a disclosure primitive whose default state is closed
- Keep passive onboarding available as an explicit platform rule for surfaces that truly need it
- Ensure avatar copy can be submitted reliably via pointer and keyboard
- Preserve optimistic catalog behavior without coupling route-local transient state to store reconciliation

**Non-Goals**

- Redesign the overall `Workspaces` layout
- Remove the global `?` shortcut
- Build a broader tooltip/onboarding framework in this change

## Decisions

### Make passive first-visit onboarding explicit

`HelpHint` will gain an explicit `passiveOnFirstVisit` capability. Only surfaces that opt into that behavior may auto-open passively on first visit. All other hints stay closed until user intent.

### Separate discoverability from persistence

Hover, focus, and click disclosure must not depend on IndexedDB dismissal state. Persistence is only relevant for the optional passive first-visit onboarding path, not for ordinary tooltip usage.

### Restore form semantics for avatar copy

The `Copy avatar` dialog will use a real `<form>` submit boundary. The submit handler will snapshot `workspacePath`, `sourceAvatar`, and `targetAvatar` before mutating reactive selection state, so optimistic selection and later reconciliation cannot race against the live derived selection.

## Risks / Trade-offs

- [Risk] Existing surfaces that accidentally relied on implicit passive onboarding will become quieter. -> Mitigation: the new opt-in is explicit and can be enabled case by case.
- [Risk] Optimistic selection could stay wrong after a failed copy. -> Mitigation: restore the prior avatar selection on failure.
- [Risk] Adding a new custom-element prop can drift between Lit and Svelte wrappers. -> Mitigation: keep the prop strongly typed and cover it in web-component tests.

## Context

The top-level `Terminals` workbench keeps one fixed `New terminal` tab and routes each created terminal to `/terminals/{terminalId}`. Browser evidence shows a mismatch between creation and navigation: the terminal is created and appended to the tab strip, but the operator remains on the previously selected terminal.

The likely race is between:

- the create route navigating to the new terminal
- the terminal detail fallback law that redirects when the selected terminal is not yet found in the loaded terminal catalog

## Goals / Non-Goals

**Goals:**

- Ensure a successful terminal creation focuses the new terminal deterministically.
- Prevent route fallback logic from overriding the just-created terminal handoff.
- Keep the fix local to the terminal workbench flow and easy to regression-test.

**Non-Goals:**

- Redesign the terminal create form.
- Change terminal tab ordering or tab-close semantics.
- Introduce a generic optimistic-navigation framework for all workbenches.

## Decisions

### Hydrate the terminal catalog before final navigation

After creating a terminal, the create route will ensure the global terminal catalog is hydrated before navigating to the canonical `/terminals/{terminalId}` route. This keeps the destination route addressable before any fallback effect evaluates.

Alternative considered:

- Let the destination route absorb the race by suppressing fallback for a time window.
  Why rejected: it turns a deterministic create handoff into a timing-based exception.

### Tighten the create route contract instead of adding feature glue elsewhere

The create-and-focus rule belongs to the create route itself. The fix will avoid introducing shell-level or tab-strip-level navigation glue.

Alternative considered:

- Patch the workbench layout to auto-select the newest terminal tab after any create.
  Why rejected: tab order is not the same as operator intent, and that would couple generic tab chrome to create-route semantics.

## Risks / Trade-offs

- [Risk] An extra hydration call after create adds one more round trip. -> Mitigation: the call is only on explicit terminal creation and it buys deterministic route correctness.
- [Risk] If terminal creation returns an unavailable terminal id, the route may still fail. -> Mitigation: keep the canonical id sourced from the create result and preserve existing error handling if the terminal never becomes addressable.

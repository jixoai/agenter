## Context

The repository moved shared scroll ownership into `@agenter/svelte-components`. `ScrollView` wraps `@tanstack/svelte-virtual`, but its local typing layer drifted from the package currently installed in the workspace:

- `Key` is no longer exported from `@tanstack/svelte-virtual`
- `measureElement` callbacks receive the core `Virtualizer` shape, not the Svelte store wrapper type
- the current null-filter and predicate flow inside `scroll-view.svelte` leaves Svelte with nullable row types

These failures surface in `@agenter/webui typecheck` even when page behavior is otherwise correct.

## Goals / Non-Goals

**Goals:**

- Restore type-safe compilation for the shared `ScrollView` primitive.
- Keep the repair inside the shared primitive instead of patching downstream packages.
- Preserve the existing public `ScrollView` behavior and layout contract.

**Non-Goals:**

- Redesign `ScrollView` visuals or runtime behavior.
- Replace TanStack virtualization.
- Introduce a second package-local scroll primitive for WebUI.

## Decisions

### ScrollView reuses TanStack-exported structural types instead of shadowing them

The shared primitive will derive key and virtualizer callback types from the installed TanStack exports instead of maintaining its own stale aliases.

Alternative considered:

- Hardcode `number | string | bigint` and wrapper-specific callback shapes locally.
  Why rejected: that would recreate the same drift risk the next time the dependency evolves.

### Nullable virtual rows are normalized before template rendering

The component will construct concrete virtual row arrays before entering the template so Svelte no longer has to prove nullable branches across the render loop.

Alternative considered:

- Keep the `map(...).filter(...)` pipeline with stronger assertions.
  Why rejected: the current predicate already demonstrates that Svelte's generic narrowing is fragile there.

## Risks / Trade-offs

- [Risk] Tightening the shared type contract could reveal additional downstream misuse. -> Mitigation: validate both `@agenter/svelte-components` and `@agenter/webui`.
- [Risk] Local helper refactors could accidentally change runtime virtualization behavior. -> Mitigation: keep runtime logic structurally identical and verify with focused validation.

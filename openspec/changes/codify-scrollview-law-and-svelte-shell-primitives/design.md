## Context

The React package already documented a preference for `ScrollViewport`, but the source still uses raw `overflow-*` utilities in dialogs, sheets, preview blocks, tabs, and virtualized lists. The Svelte rewrite is the right moment to move from preference to hard law and make one primitive responsible for both scrolling and virtualization.

## Goals / Non-Goals

**Goals:**
- Introduce a shared `ScrollView` primitive for static and virtual lists.
- Ensure layout shells, dialogs, sheets, and system panels stop owning scroll with raw CSS utilities.
- Use shadcn-svelte composition patterns for tabs, dialogs, sheets, and list containers.
- Add tests or static checks that make scroll regressions visible.

**Non-Goals:**
- Do not preserve the old React `ScrollViewport` implementation.
- Do not ban visual clipping primitives needed for animation masks.
- Do not solve every feature surface in this change; feature migrations can consume the primitive later.

## Decisions

### 1. `ScrollView` is the only scroll owner in feature code
All feature-level vertical or horizontal scrolling will be expressed through a shared primitive. Raw `overflow-*` remains allowed only inside the primitive implementation or narrowly documented animation masks.

Alternative considered:
- Keep guidelines only. Rejected because the existing code already drifted away from the guidance.

### 2. Virtualization is a mode, not a separate primitive
`ScrollView` will support static content and item virtualization through a shared API so feature code does not branch between two unrelated scroll abstractions.

Alternative considered:
- Keep separate scroll and virtual list primitives. Rejected because it leaks implementation choices into every feature.

### 3. Shell containers should compose official shadcn-svelte primitives
Dialogs, sheets, tabs, and surface cards in the new WebUI will be built from shadcn-svelte components, with project wrappers where semantics need to be standardized.

Alternative considered:
- Continue hand-rolling shell containers. Rejected because it recreates the same inconsistency the user explicitly called out.

## Risks / Trade-offs

- **Primitive too generic to adopt quickly** → Keep the API intentionally small: axis, mode, items, size estimation, overscan, anchoring.
- **Horizontal preview blocks still need special handling** → Treat them as `ScrollView` usage rather than as CSS exceptions.
- **Static analysis creates false positives** → Scope the guard to the new Svelte package and document the few allowed internal exceptions.

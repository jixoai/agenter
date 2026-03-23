## Context

`AppRoot` currently renders a passive global header while `WorkspaceShellFrame` renders a second workspace header and conditionally appends `BottomNavBar`. That violates the intended shell hierarchy and creates duplicated chrome. In parallel, `AIInputToolbar` always renders all shortcut hints and text labels inline, so compact widths either wrap noisily or waste space.

## Goals / Non-Goals

**Goals**
- Collapse the workspace shell into one top header surface.
- Keep app-level navigation, workspace identity, tabs, and route actions visually separated inside that one surface.
- Remove `BottomNavbar` and the viewport mode that enabled it.
- Introduce one reusable adaptive icon-button primitive for container-aware controls.
- Make Chat help affordances collapse into a secondary rich-tooltip before primary actions are degraded.

**Non-Goals**
- Move GlobalSettings into the page header.
- Redesign sidebar/drawer navigation.
- Introduce a different input editor or markdown renderer.

## Decisions

### Unified header stays one surface with two rows
`TopHeader` will be the only route-adjacent shell header. Row 1 remains app-level: drawer trigger, app identity, location, connection/runtime status. Row 2 appears only on workspace routes and carries workspace identity, route tabs, and route-local actions.

Why: this keeps one header surface while preserving semantic layering.

### Bottom navigation is removed, not hidden
`useAdaptiveViewport` stops computing a workspace nav mode and `WorkspaceShellFrame` stops rendering `BottomNavBar`.

Why: the approved product decision is top-only navigation, and keeping the old mode would preserve dead complexity.

### Adaptive affordances use CSS first, ResizeObserver second
Container queries decide coarse layout bands for the toolbar; `ResizeObserver` inside the adaptive button decides whether the individual label can fit.

Why: container queries handle layout policy, while the observer handles local affordance fit without brittle viewport heuristics.

### Help content collapses before primary actions do
The toolbar keeps `Send` as the highest-priority labeled action. Shortcut/help chips collapse into a `?` rich-tooltip first; Attach/Screenshot then degrade to icon-only buttons when space is tight.

Why: help is secondary, actions are primary.

## Risks / Trade-offs

- A single header can become crowded if roles blur. Mitigation: keep app-level status on row 1 and workspace-local controls on row 2 only.
- ResizeObserver can thrash if it drives layout loops. Mitigation: observe the label wrapper width, derive a boolean, and only update state when the mode actually changes.
- Rich tooltip behavior differs between pointer and touch devices. Mitigation: use hover/focus on fine pointers and click activation on coarse pointers through a popover-style component.

## Migration Plan

1. Add the OpenSpec delta and adaptive-affordance primitive.
2. Introduce the unified `TopHeader` and route plumbing in `AppRoot` / `WorkspaceShellFrame`.
3. Remove `BottomNavbar` usage and delete the old nav-mode branch.
4. Refactor the Chat composer toolbar to use adaptive buttons and collapsible help.
5. Add Storybook DOM coverage for shell and composer behavior across compact and wide containers.

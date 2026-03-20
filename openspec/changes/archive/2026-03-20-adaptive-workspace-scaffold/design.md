## Context

The existing shell currently stacks three separate ownership layers in a conflicting way:
- `AppRoot` owns the global header and also injects route padding.
- `WorkspaceShellFrame` owns a workspace card plus optional bottom nav.
- `ChatPanel` still owns `SessionToolbar`, so session actions are rendered inside the chat body instead of the workspace route scaffold.

This creates repeated identity chrome, conflicting padding, and different accidental scroll owners per route.

## Goals / Non-Goals

### Goals
- Introduce one adaptive viewport decision point that uses width class plus orientation.
- Keep `AppHeader` global and passive.
- Make `WorkspaceHeader` the only workspace-route header.
- Preserve a distinct scroll model for Chat, Devtools, and Settings.
- Reuse existing `Sheet` infrastructure for portrait master-detail detail flows.

### Non-Goals
- No backend or transport changes.
- No redesign of message rendering semantics beyond moving route chrome ownership.
- No full visual-system rewrite.

## Architecture

### 1. Adaptive viewport model

Add `useAdaptiveViewport()` in `features/shell/`.

Outputs:
- `widthClass`: `compact | medium | expanded`
- `orientation`: `portrait | landscape`
- `compact`: derived helper for existing callers
- `workspaceNavMode`: `top | bottom`
- `globalNavMode`: `rail | drawer`

Rules:
- `expanded` => `workspaceNavMode = top`
- `landscape` => `workspaceNavMode = top`
- otherwise => `workspaceNavMode = bottom`
- `compact` => `globalNavMode = drawer`
- otherwise => `globalNavMode = rail`

This replaces the old single-query `useCompactViewport()` decision for workspace shell behavior.

### 2. Shell ownership

`AppRoot`
- keeps left rail on non-compact viewports and drawer on compact viewports
- keeps `AppHeader` as a thin global status bar only
- stops adding route-content padding that competes with workspace route layout

`WorkspaceShellFrame`
- becomes the workspace route scaffold
- owns `WorkspaceHeader`, route content viewport slot, and conditional `BottomNavBar`
- exposes `headerContent` so routes can render route-local controls without leaking them into `AppHeader`

`WorkspaceHeader`
- shows workspace identity, active route title, optional route tabs when `workspaceNavMode = top`, and route-local actions such as the state-driven session action on Chat

### 3. Route-specific scroll models

`Chat`
- outer frame: `grid rows [auto minmax(0,1fr)]`
- route header stays outside content
- `ChatPanel` removes `SessionToolbar`
- chat stage remains `grid rows [minmax(0,1fr) auto]`
- `ChatConversationViewport` remains the only main scroll owner

`Devtools`
- route card becomes `grid rows [auto minmax(0,1fr)]`
- technical tabs stay fixed at the top of the route content
- active panel owns its own scroll behavior
- `CycleInspectorPanel` uses split panes for top-nav layouts and right-sheet detail for bottom-nav layouts

`Settings`
- `SettingsPanel` keeps effective view as a single scroll/editor surface
- layer list/detail becomes split panes for top-nav layouts and right-sheet detail for bottom-nav layouts

### 4. RightSheet master-detail reuse

We already have a right-side `Sheet` primitive and `MasterDetailPage`. For route-local detail flows we do not need a generic new abstraction yet.

Implementation approach:
- `CycleInspectorPanel` gets `compactDetailSheet` behavior and local selection/open state.
- `SettingsPanel` gets the same portrait-only detail sheet behavior for layer editing.
- Desktop and landscape keep side-by-side layout.

This follows YAGNI: no new generic framework until two route-local implementations prove the shared API.

## Testing Strategy

- Unit test `useAdaptiveViewport` decision rules.
- Storybook / DOM coverage for `WorkspaceShellFrame`, `BottomNavBar`, `CycleInspectorPanel`, and `SettingsPanel` with portrait vs landscape behavior.
- Browser walkthrough for:
  - desktop workspace route: top nav, no bottom nav
  - compact landscape: top nav, no bottom nav
  - compact portrait: bottom nav, right-sheet detail flows
  - Chat: transcript visible with fixed composer and working scroll

## Context

`workspace-shell-settings-notifications` fixed the ownership model: settings now belong to a workspace, unread notifications exist as an app-server projection, and the shell is route-driven. The remaining problem is UI cohesion. `AppRoot` still treats the global shell as one oversized page, `AppHeader` exposes too many actions at once, and async panels each invent their own loading treatment. At the same time, users can run multiple sessions in the background, but the shell does not yet provide a dedicated place to switch among those running sessions.

This iteration is intentionally WebUI-heavy. The backend notification registry and workspace settings APIs are already in place; the work here is to turn those contracts into a more coherent application shell.

## Goals / Non-Goals

**Goals:**
- Add a secondary running-session rail for desktop and a compact running-session switcher for mobile.
- Introduce a reusable async surface primitive that models loading and emptiness as orthogonal UI concerns.
- Simplify the shell hierarchy so page-level padding and chrome are owned in one place instead of repeated across feature panels.
- Reduce `AppHeader` action density and move secondary actions into shadcn-style overflow surfaces.
- Keep unread session indicators visible on the new running-session entry points.

**Non-Goals:**
- Do not change LoopBus, session persistence, or app-server notification storage semantics.
- Do not add a new primary navigation item beyond `Quick Start` and `Workspaces`.
- Do not redesign feature internals such as chat rendering or task execution in this change.
- Do not add new global settings flows; workspace-scoped settings ownership remains unchanged.

## Decisions

### 1. Keep the primary sidebar static and add a secondary session rail

The user requirement is explicit: the leftmost primary sidebar must stay limited to `Quick Start` and `Workspaces`. Running sessions therefore need a second navigation layer, not more primary items.

- On desktop, render a `SessionRail` between the primary sidebar and the main workspace content.
- Populate the rail from the existing runtime snapshot: sessions with live runtime state or `status === "running" | "starting"` appear there.
- Rail items show session name, `sessionId`, workspace avatar/label, and unread badge.
- On mobile, do not render a permanent rail; expose the same running-session entries through a compact header menu/sheet.

Alternative considered: continue adding dynamic items to the primary sidebar. Rejected because it recreates the previous shell sprawl and conflicts with the stable-navigation requirement.

### 2. Model async UI as two dimensions: data presence and loading activity

Panels currently conflate `loading` with `empty`. That prevents clear behavior when existing data is refreshing.

- Add a shared `AsyncSurface` wrapper with explicit inputs such as `hasData`, `loading`, `empty`, and optional skeleton/overlay content.
- Empty + loading renders skeleton/placeholder treatment.
- Empty + not loading renders the empty-state copy.
- Has data + loading keeps the existing content visible and overlays a lighter loading affordance instead of blanking the panel.
- Has data + not loading renders the steady-state content.

Alternative considered: fix each panel individually. Rejected because it would repeat layout and state logic in every feature surface.

### 3. Shell hierarchy must be owned top-down

The current shell still leaks page chrome into feature components, causing duplicated padding, nested cards, and inconsistent mobile behavior.

- `AppRoot` owns global application chrome: background, primary sidebar, desktop session rail slot, and the route outlet frame.
- `AppHeader` owns route title, primary route affordances, and overflow actions.
- `WorkspaceShellFrame` owns workspace-level chrome only: workspace context strip, content area, and `BottomNavBar`.
- Feature panels (`QuickStartView`, `WorkspacesPanel`, `WorkspaceSessionsPanel`, `SettingsPanel`, Devtools panes) own only their inner surfaces.

Alternative considered: preserve the current per-panel cards and patch spacing locally. Rejected because it preserves layout drift and keeps future panels inconsistent.

### 4. Use shadcn-style primitives to reduce action density without losing power

The header needs fewer always-visible buttons, especially on mobile.

- Add missing shadcn-style wrappers such as `dropdown-menu` and `skeleton` on top of the project's Base UI approach.
- Keep high-priority actions visible; move secondary actions and running-session navigation into compact menus/sheets.
- Reuse the same icon/button spacing contract across header, rail, and list items.

Alternative considered: hand-roll more ad hoc popovers and loading placeholders. Rejected because the project already committed to shadcn-style primitives and needs stricter consistency.

## Risks / Trade-offs

- [The rail can overload desktop width] → Keep it narrow, text-trimmed by default, and make the main content remain the dominant region.
- [AsyncSurface can become too generic] → Keep the API intentionally small and only encode the four agreed states plus optional overlay/empty slots.
- [Header overflow can hide important actions] → Keep one direct path to the current route and move only secondary actions behind menus.
- [Existing panels may rely on page-level padding] → Refactor panel shells in the same change so feature content still has clear spacing after outer chrome is simplified.

## Migration Plan

1. Add shared UI primitives (`dropdown-menu`, `skeleton`, `AsyncSurface`) and capture their behavior with Storybook DOM tests.
2. Introduce the desktop/mobile session-navigation surfaces and refactor `AppRoot` / `AppHeader` / `WorkspaceShellFrame` around the new hierarchy.
3. Migrate `QuickStartView`, `WorkspacesPanel`, `WorkspaceSessionsPanel`, `SettingsPanel`, and workspace Devtools surfaces to the shared async-state contract.
4. Run targeted Storybook DOM tests and browser walk-throughs to verify navigation, unread badges, and loading behavior.

## Open Questions

- None. The data sources already exist; this change is about shell composition and UI contracts.

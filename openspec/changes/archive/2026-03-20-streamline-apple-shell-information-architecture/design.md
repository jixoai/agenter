## Context

The recent shell refactor established the left sidebar as the highest-priority application navigation and introduced the workspace shell plus mobile bottom navigation. The current implementation still overlaps responsibilities: `AppHeader` shows route labels, path context, runtime status, notices, and session actions; `WorkspaceShellFrame` repeats workspace and session identity; `ChatPanel` repeats route and runtime status; and the mobile drawer repeats route-local actions that already exist inside the workspace shell. The result is not just visual clutter, but also an unclear ownership model for layout padding, disclosure, and session controls.

This change stays inside `packages/webui` and `AGENTS.md`. It does not change runtime behavior, session lifecycle semantics, or app-server contracts. The purpose is to make the shell decision-complete from an information-architecture point of view so future UI iterations do not drift back into duplicated surfaces.

## Goals / Non-Goals

**Goals:**
- Give each shell layer one responsibility: app header for global location/navigation, workspace shell for workspace context and route switching, route surfaces for local actions and notices.
- Replace separate Start and Stop affordances with one state-driven session control located in the Chat route toolbar.
- Make the compact drawer a pure global-navigation surface that lists only primary routes and running sessions.
- Restructure the workspace shell so the bottom navigation is a true footer container instead of an extra padded content block.
- Capture these rules in `AGENTS.md` as reusable design constraints.

**Non-Goals:**
- No changes to app-server notifications, runtime phases, or session state machines.
- No visual rebrand or token-system rewrite beyond what is necessary to support the new hierarchy.
- No new global routes or new session lifecycle actions beyond the existing start/stop toggle.

## Decisions

### 1. Make the app header passive and global
`AppHeader` will only express app-level location and app-level passive state. It will keep the app identity, current location label, connection state, AI state, and the compact drawer trigger. It will stop rendering workspace path, route tabs, session notices, or session actions.

Rationale:
- The header becomes scannable and no longer competes with route content.
- It establishes a stable top layer for all routes, not just workspace routes.
- It removes the repeated chip stack currently shown in the screenshots.

Alternatives considered:
- Keep the current header and only reduce styles: rejected because the duplication is structural, not cosmetic.
- Move everything into chips with lighter styling: rejected because it preserves the same information collision.

### 2. Make the workspace shell own workspace context and route switching only
`WorkspaceShellFrame` will render a single workspace context bar plus route navigation. Desktop uses segmented tabs in the workspace bar. Mobile uses a bottom footer nav only. The workspace bar no longer renders session identity or session unread state.

Rationale:
- Workspace identity and workspace route switching belong together.
- Session identity belongs to the active route surface, because different routes use it differently.
- The bottom navigation becomes the only mobile route switcher, which removes repeated route entries from the header menu.

Alternatives considered:
- Keep session name in the workspace bar: rejected because it duplicates the route-local toolbar and weakens the workspace/session distinction.
- Keep desktop tabs and mobile tabs simultaneously: rejected because it recreates duplicated navigation on compact layouts.

### 3. Move the sole session action into the Chat route toolbar
The Chat route will gain a dedicated `SessionToolbar` with the session name, a passive session state label, and one state-driven `SessionRunControl`. `Start` and `Stop` will become one toggle-style action based on current session/runtime state.

Rationale:
- The user’s primary session interaction happens in Chat.
- One primary action is easier to understand than two competing buttons or menu items.
- Route-local notices such as “no terminal configured” belong with the route that needs them.

Alternatives considered:
- Keep the control in the header overflow: rejected because the header should not own route-local stateful actions.
- Put the control in the workspace bar so all routes see it: rejected because Devtools and Settings are supporting routes, not the session’s primary control surface.

### 4. Simplify the compact drawer to global navigation plus running sessions
The drawer will reuse the sidebar content model and only show `Quick Start`, `Workspaces`, and running sessions. It will not show `Chat`, `Devtools`, `Settings`, or session run controls.

Rationale:
- The drawer becomes a true mobile equivalent of the left sidebar.
- It avoids listing the same route/action capabilities in both drawer and bottom nav.
- It matches the user’s request that navigation be simplified and deduplicated.

Alternatives considered:
- Keep the current mixed action menu: rejected because it conflates global navigation, local navigation, and session actions.

### 5. Treat the bottom nav as shell footer layout, not a padded content card
`BottomNavBar` will become a footer container owned by `WorkspaceShellFrame`. The frame will use a clear `header / body / footer` structure, where `body` is the only main content region and `footer` is responsible for safe-area padding and tab layout.

Rationale:
- It fixes the repeated padding issue by giving each container one layout job.
- It aligns with the existing AGENTS rule that every panel should have one main scroll region.
- It makes mobile behavior easier to test and reason about.

Alternatives considered:
- Keep the current sticky nav and tweak spacing classes: rejected because the current bug comes from nested ownership, not a single spacing token.

## Risks / Trade-offs

- [Risk] Route-local session actions only appear in Chat, so users on Devtools or Settings need to switch tabs to control a session. → Mitigation: keep the control placement consistent and make the Chat tab the obvious primary route.
- [Risk] Removing the header overflow may hide actions currently used in tests or stories. → Mitigation: update stories and integration tests together with the refactor so the new ownership model becomes the only supported contract.
- [Risk] Restructuring `WorkspaceShellFrame` could regress mobile scrolling. → Mitigation: preserve one scroll owner in the content body and add DOM/browser coverage for footer isolation.
- [Risk] Apple-style guidance may be interpreted as a pure visual brief. → Mitigation: encode it in AGENTS as explicit structural and hierarchy rules, not aesthetic adjectives.

## Migration Plan

1. Add OpenSpec delta specs and tasks for the shell information-architecture update.
2. Refactor `AppHeader`, `WorkspaceShellFrame`, `BottomNavBar`, `AppRoot`, and `ChatPanel` to match the new ownership model.
3. Update stories and tests for header, drawer, bottom nav, and session run control.
4. Add the new information-architecture best practices to `AGENTS.md`.
5. Run focused WebUI validation and archive the change once the behavior matches the updated specs.

Rollback is straightforward because the change is purely in WebUI composition and docs. Reverting the shell components and spec deltas restores the previous layout.

## Open Questions

- None. The session action location has already been locked to the Chat route toolbar.

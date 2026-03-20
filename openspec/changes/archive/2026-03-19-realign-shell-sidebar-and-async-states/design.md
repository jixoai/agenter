## Context

The current WebUI shell is midway through a navigation refactor: `Quick Start` and `Workspaces` already became the only primary routes, but running sessions still render through a separate desktop `SessionRail` and a mobile header-only switcher. At the same time, a new `AsyncSurface` primitive exists but is not yet the authoritative contract for all fetch-driven panels, so some views still show empty copy during first load or hand-roll their own loading behavior.

The change is cross-cutting inside `packages/webui` because it touches the application shell, mobile navigation, route header density, and several independent panel surfaces. Existing runtime/session/notification state from the client SDK is already sufficient; the refactor is entirely about layout composition and state presentation.

## Goals / Non-Goals

**Goals:**
- Make the left sidebar the highest-priority desktop chrome and place running sessions inside it as a secondary section.
- Make the mobile navigation drawer reuse the same sidebar model, including running sessions, instead of splitting session access into header-only affordances.
- Keep `AppHeader` route-aware but compact, especially on mobile, with session actions folded into overflow affordances.
- Promote async loading to a strict four-state UI contract and apply it consistently across major fetch-driven surfaces.
- Update tests so shell hierarchy and async states are enforced by DOM contracts instead of informal implementation details.

**Non-Goals:**
- No app-server, TRPC, or client-sdk protocol changes.
- No changes to session lifecycle semantics, notification generation rules, or workspace/session business logic.
- No new global routes beyond the existing Quick Start, Workspaces, and workspace shell routes.

## Decisions

### 1. Replace `SidebarNav + SessionRail` with one sidebar composition
Use one `AppSidebar` composition with explicit sections instead of a separate `SessionRail` component.

Rationale:
- It matches the requested hierarchy: the left navigation is visually and structurally dominant.
- It removes duplicated session entry logic between desktop rail and mobile switcher.
- It gives one place to render unread badges, active session state, and workspace avatars.

Alternatives considered:
- Keep the desktop rail and call it part of the left chrome: rejected because it still keeps session navigation outside the sidebar mental model.
- Keep header switcher on mobile: rejected because it overloads the header and splits navigation ownership.

### 2. Keep running sessions as a sidebar secondary section, not primary routes
Running sessions remain a secondary section under the primary entries `Quick Start` and `Workspaces`.

Rationale:
- This preserves the product model that only two items are true application roots.
- It still exposes all active sessions at the highest shell level without turning them into persistent global routes.
- It keeps the sidebar dense and IDE-like rather than card-driven.

Alternatives considered:
- Promote every running session to primary navigation: rejected because it recreates the old sidebar sprawl.
- Use icon-only entries: rejected because it is too opaque once multiple sessions share a workspace.

### 3. Move header and status ownership into the main shell
`AppHeader` and the current status strip become part of the right-side main shell, not outer page chrome.

Rationale:
- This enforces the desired hierarchy: sidebar first, then main shell, then content.
- It lets the header describe the active route/workspace/session without competing with global navigation.
- It reduces padding conflicts because route content now sits under a single main-shell container.

Alternatives considered:
- Keep a global top header/status bar spanning sidebar + content: rejected because it breaks the sidebar-first layout and complicates mobile composition.

### 4. Collapse mobile header actions into one compact route header
On compact viewports, `AppHeader` keeps only navigation trigger, route/workspace context, unread/status badges, and an overflow menu for route actions.

Rationale:
- The current header exposes too many direct actions and duplicates session navigation.
- A compact, route-aware header is easier to scan and frees room for long workspace paths.
- Session switching is already available through the drawer, so it does not belong in the header.

Alternatives considered:
- Keep explicit Workspaces / Chat / session controls visible in mobile header: rejected because it creates action overload and inconsistent wrapping.

### 5. Promote `AsyncSurface` to an explicit four-state contract
`AsyncSurface` will accept an explicit render state union (`empty-loading`, `empty-idle`, `ready-loading`, `ready-idle`) plus consistent slots for skeleton, empty, and content.

Rationale:
- Several current panels compute `loading` and `hasData` differently, which already caused incorrect first-load behavior.
- An explicit state contract is easier to test and harder to misuse.
- The same contract can be reused across shell panels without leaking each panel's fetch logic into JSX branches.

Alternatives considered:
- Keep deriving behavior from `loading + hasData` booleans everywhere: rejected because it is already producing inconsistent UI and ambiguous tests.

### 6. Expand async-surface usage to all fetch-driven shell panels
The shared async contract will be applied to Workspaces, Workspace Sessions, Settings, Model, Terminal, Tasks, Process, and LoopBus.

Rationale:
- The original requirement explicitly calls out repeated missing loading states across the application.
- Applying the contract only to some pages leaves the shell inconsistent and forces duplicated empty/loading markup.
- These panels already have loading/empty concepts; they only need consistent rendering ownership.

## Risks / Trade-offs

- [Risk] The repo is already dirty around WebUI shell files, so refactoring could accidentally absorb unrelated work. → Mitigation: limit edits to the shell/sidebar/panel surfaces required by this change and avoid reverting any pre-existing edits.
- [Risk] Replacing `SessionRail` may break existing tests or stories that still encode the old rail behavior. → Mitigation: update story fixtures and app tests in the same change so the new sidebar contract becomes the single truth.
- [Risk] Moving header/status ownership can introduce layout regressions on compact viewports. → Mitigation: validate desktop and compact layouts through Storybook DOM plus one real browser walkthrough.
- [Risk] Making async states explicit requires touching several panels at once. → Mitigation: centralize the state mapping in the shared primitive and only adapt panel inputs/slots, not their data loading code.

## Migration Plan

1. Introduce the new OpenSpec delta specs and tasks for sidebar hierarchy plus async-state contract.
2. Implement the sidebar composition and remove the separate rail/switcher rendering path.
3. Refactor the main shell layout so header/status live inside the main content shell.
4. Upgrade `AsyncSurface` and adapt each affected panel.
5. Update Storybook DOM tests, app integration tests, and run targeted WebUI verification.
6. Archive the change after behavior matches the updated specs.

Rollback is straightforward because there is no backend or data migration; reverting the WebUI shell and spec changes restores the previous behavior.

## Open Questions

- None. The navigation placement, mobile behavior, and running-session density were already decided during planning.

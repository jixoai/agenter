## Context

The current shell architecture already separates the global sidebar, workspace shell, and the shared `MasterDetailPage`. Recent browser walkthroughs proved that most navigation and chat flows now work, but they also exposed two remaining structural bugs.

First, the compact Workspaces flow still depends on a desktop-flavored activation model: a workspace card selection updates `selectedWorkspacePath`, but the mobile detail sheet auto-opens from `selectedWorkspaceSessionId`. Because no session is selected yet, the compact detail sheet never opens. The current `onDoubleClick` workspace activation path is not viable on touch devices.

Second, transport state is modeled too loosely. `RuntimeStore` only exposes `connected: boolean`, sets it during snapshot success, and flips it false when the runtime event subscription errors. That leaves two gaps: browser offline events are not represented directly, and retained live streams such as `runtime.apiCalls.subscribe` are not automatically restored after reconnect. As a result, the header can show stale connectivity and Devtools can silently stop receiving live model-call data after a disconnect.

## Goals / Non-Goals

**Goals:**

- Make compact Workspaces selection open the Sessions detail surface through the existing shared master-detail mechanism.
- Replace the implicit connection boolean with an explicit transport-status contract while keeping a derived compatibility flag for existing UI call sites.
- Ensure retained API-call subscriptions are re-established automatically after reconnect without creating duplicate streams.
- Cover the repaired behaviors with client-sdk tests, Storybook DOM tests, and real browser walkthrough evidence.

**Non-Goals:**

- No new information-architecture redesign beyond the two confirmed regressions.
- No server-side protocol rewrite, websocket library swap, or new persistence model.
- No change to Session-item activation semantics beyond the specific Workspace compact-flow repair.

## Decisions

### 1. Add an explicit transport lifecycle to `RuntimeClientState`

`RuntimeClientState` will gain `connectionStatus: "connecting" | "connected" | "reconnecting" | "offline"`, while `connected` remains as a derived compatibility field. `RuntimeStore` becomes the single owner of transport-state transitions through a small helper instead of open-coded `{ connected: true/false }` assignments.

Rationale:

- The header and route gating need more than a binary answer.
- Browser offline is semantically different from reconnect backoff.
- This keeps the public API simple without introducing a larger state-machine framework.

Alternatives considered:

- Replace `connected` everywhere with a richer object immediately: rejected because it widens the blast radius unnecessarily.
- Keep the boolean and infer offline state inside WebUI: rejected because transport truth belongs in the client runtime layer.

### 2. Let compact Workspaces auto-open from workspace selection, not session selection

`WorkspacesRouteView` will drive the mobile detail sheet from `selectedWorkspacePath`, and Workspace cards will stop exposing a separate double-click activation path. Single click/tap remains the only selection contract: selecting a workspace opens Sessions on compact viewports and updates the desktop detail pane on larger viewports.

Rationale:

- The shared master-detail abstraction already supports `detailSelectionKey`; it is wired to the wrong owner.
- Mobile needs a single-tap path, not a desktop-only secondary gesture.
- Removing workspace double-click reduces interaction ambiguity and simplifies tests.

Alternatives considered:

- Add a dedicated "Open Sessions" icon just for compact mode: rejected because it duplicates the selected-state contract and adds more chrome.
- Force the detail sheet open in `WorkspaceItem` directly: rejected because viewport-specific presentation belongs in route/shell composition, not item rows.

### 3. Reconnect retained API-call streams from the runtime store

The `apiCallStreams` registry will remain the authoritative reference-counted list for live Devtools subscriptions. On transport loss, existing retained entries keep their `count` and latest cursor but drop their active subscription handle. After reconnect, `RuntimeStore` walks that registry and re-subscribes each retained stream exactly once.

Rationale:

- Retain/release semantics already exist and should remain the source of truth.
- Reconnect recovery belongs next to the transport lifecycle so Devtools does not need route-level special cases.
- This preserves the current lazy subscription model and avoids always-on background streams.

Alternatives considered:

- Make Devtools route effects re-run on every reconnect only: rejected because the store still needs to recover when the route stays mounted and the effect dependencies do not change.
- Recreate every live stream eagerly on every `connectOnce`: rejected because only retained streams should consume resources.

### 4. Surface transport status through shared UI metadata instead of bare strings

`AppHeader` will render transport status from a shared helper that maps `connectionStatus` to label and tone. `AI ready/working` remains separate from transport state so the UI does not conflate model activity with network health.

Rationale:

- It removes more hard-coded branch strings from the component layer.
- It keeps transport state objective and reusable across future notices or badges.

Alternatives considered:

- Keep ad-hoc strings inside `AppHeader`: rejected because this change is specifically about making connection state trustworthy and centralized.

## Risks / Trade-offs

- [Risk] Reconnect recovery can accidentally create duplicate event or API-call streams. → Mitigation: centralize subscription setup/teardown and dedupe by registry entry, plus add reconnection tests.
- [Risk] Browser `online/offline` listeners only exist in web environments. → Mitigation: guard listener registration with `typeof window !== "undefined"` and keep non-browser runtimes on websocket events alone.
- [Risk] Compact master-detail auto-open could become too eager when selection changes programmatically. → Mitigation: key the auto-open behavior strictly to `selectedWorkspacePath` inside the Workspaces route, where that selection is user-facing.
- [Risk] Existing tests may still depend on `connected: boolean`. → Mitigation: preserve the boolean as a derived field and migrate tests to cover both compatibility and the new `connectionStatus` contract.

## Context

The backend and SDK already support global terminal listing, read/write operations, grant management, approval requests, activity history, and focus APIs. The remaining frontend problems are largely product-model errors: treating terminals as workspace-owned, hiding actor context, and exposing terminal-wide focus toggles instead of seat-level state.

## Goals / Non-Goals

**Goals:**
- Build a standalone terminal-system surface with list, transcript, actions, and users/access views.
- Make actor selection explicit for terminal tool calls and access operations.
- Present focus/unfocus as per-user seat state rather than a terminal-global toggle.
- Ensure terminal history and metadata survive page refreshes.

**Non-Goals:**
- Do not couple terminal-system UI to message-system or task-system.
- Do not rebuild PTY/runtime server behavior in this change.
- Do not preserve the old workspace-owned terminal route model.

## Decisions

### 1. `/terminals` is a global terminal surface
The route will present global terminals independently of workspaces, with terminal metadata treated as terminal facts rather than workspace facts.

Alternative considered:
- Keep terminal routes under workspaces. Rejected because terminals are now a global orthogonal system.

### 2. The side panel is split into Actions and Users
Terminal actions and terminal user/access management serve different operator jobs, so they will live in tabs within the same side panel.

Alternative considered:
- Keep one mixed activity panel. Rejected because it conflates transcript/tool actions with access administration.

### 3. Focus is a seat-level behavior
The UI will expose focus/unfocus controls per user in the terminal's user list. These controls model the user's seat state, which downstream systems can use for attention injection.

Alternative considered:
- Preserve one terminal-wide focus button. Rejected because it contradicts the per-user focus model already chosen for the platform.

### 4. Terminal transcript and actions should be durable on refresh
The route will fetch and restore terminal transcript/activity state from the SDK instead of relying solely on ephemeral live updates.

Alternative considered:
- Depend on live subscription only. Rejected because refresh currently loses visible terminal evidence.

## Risks / Trade-offs

- **Transcript recovery may lag behind live updates** → Fetch durable activity on load, then layer live subscriptions on top.
- **Access UX drifts from message-system** → Share actor selection and access-dialog patterns across the two systems.
- **Per-user focus state is easy to model incorrectly** → Keep focus controls in the user list only and remove terminal-global affordances.

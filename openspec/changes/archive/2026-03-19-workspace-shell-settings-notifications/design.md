## Context

`@agenter/webui` still centralizes most navigation, settings ownership, and session orchestration inside `App.tsx`. `SettingsPanel` currently depends on `sessionId`, which forces the UI to start or select a session before editing workspace configuration. At the same time, sessions can keep running in the background, but the app has no lightweight unread-notification projection for assistant replies that arrive outside the visible Chat view.

This change touches `@agenter/app-server`, `@agenter/client-sdk`, and `@agenter/webui`, and it must preserve the current session runtime model while moving application ownership to the right layer: workspace owns settings, session owns runtime state.

## Goals / Non-Goals

**Goals:**
- Make settings resolvable and editable by `workspacePath` without requiring a session runtime.
- Replace the current local-state shell with a route-driven application shell and a workspace-scoped sub-navigation model.
- Add ephemeral unread session notifications for assistant `to_user` replies when Chat is not visible.
- Keep mobile-first behavior while preserving the existing desktop split/detail affordances where they still apply.

**Non-Goals:**
- Do not move notifications into LoopBus or `session.db`.
- Do not redesign session runtime persistence or LoopBus semantics.
- Do not reintroduce global session shortcuts in the primary sidebar.
- Do not add a durable inbox or historical notification archive.

## Decisions

### 1. Settings become a workspace-scoped app-server service

The current settings layer APIs go through `SessionRuntime`, which is the wrong owner. The new owner is `workspacePath`.

- Add workspace settings queries/mutations in `AppKernel` that call `loadSettings({ projectRoot: workspacePath, cwd: workspacePath })` directly.
- Keep the current layer metadata contract (`effective`, `layers`, `editable`, `readonlyReason`), but replace `sessionId` with `workspacePath` at the API boundary.
- Reuse the existing layer file resolution/editability rules so the UI stays consistent.

This keeps settings independent from session lifecycle and avoids booting runtimes just to inspect config.

### 2. WebUI moves to TanStack Router and a two-level shell

The current `App.tsx` owns too many orthogonal concerns: primary navigation, workspace/session selection, mobile sheets, and chat/devtools state. A typed router gives the shell a single truth source and makes session/workspace URLs shareable.

Route model:
- `/` → Quick Start
- `/workspaces` → Workspaces
- `/workspace/$workspacePath/chat?sessionId=...`
- `/workspace/$workspacePath/devtools?sessionId=...`
- `/workspace/$workspacePath/settings`

Shell model:
- Global sidebar: only `Quick Start` and `Workspaces`
- Workspace shell: route-aware `AppHeader` + `BottomNavBar(Chat/Devtools/Settings)`
- Workspaces view: keeps `Workspaces ↔ Sessions` master-detail behavior

This removes the incorrect global mixing of Chat and Settings while preserving workspace-first entry flows.

### 3. Notifications are an app-server projection, not a kernel subsystem

Unread notifications are UI/application concerns. They should not live inside LoopBus, attention-system, or session persistence.

- Add an in-memory notification registry in `@agenter/app-server`, keyed by `sessionId`
- Only project assistant messages where `channel === "to_user"`
- Only create unread notifications when the app has not marked that session's Chat view as visible and focused
- Expose notification snapshot + subscription + consume APIs

This keeps notifications cheap, ephemeral, and easy to evolve without contaminating kernel storage contracts.

### 4. Read state is driven by Chat visibility, not mere session selection

Unread should clear only when the user can actually see the conversation.

- WebUI reports session chat visibility/focus to app-server
- App-server consumes notifications up to a message id when Chat is visible and the browser window is focused
- Opening Devtools or Settings for the same session does not clear unread

This matches the product goal: background session replies should remain surfaced until the user actually sees the chat.

## Risks / Trade-offs

- [Router migration touches many UI joins] → Migrate shell state first, keep existing feature panels largely intact, and adapt them behind route loaders/props.
- [Settings APIs become breaking for existing consumers] → Update `client-sdk` and WebUI in the same change; no compatibility shim is needed for this internal monorepo.
- [Unread logic can drift from real visibility] → Base read consumption on explicit route + document visibility + window focus signals instead of inferred session selection.
- [Ephemeral notifications are lost on app-server restart] → Accept this by design; notifications are intentionally not durable.

## Migration Plan

1. Add workspace-scoped settings APIs and client-sdk bindings while keeping old session-scoped call sites compiling locally.
2. Introduce notification registry and snapshot/subscription endpoints in app-server.
3. Migrate WebUI shell to router-driven navigation and switch Settings to `workspacePath`.
4. Remove old session-owned settings flows and obsolete sidebar entries.
5. Run targeted BDD/integration/browser verification for settings, navigation, and unread behavior.

## Open Questions

- None for this iteration. The unread policy is fixed to “visible Chat + focused window auto-read”.

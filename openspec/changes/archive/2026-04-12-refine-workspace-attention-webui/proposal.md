## Why

The backend refactor already established the new platform law: Avatars are global identities, workspaces are independently mounted resources, and attention owns notification ingress. The current WebUI still reflects older workspace-local assumptions and does not yet express the new system boundaries through a stable workbench shell.

This follow-up change captures the WebUI contract before implementation so the new workspace and attention laws land as one coherent operator surface instead of another round of route-local patches.

## What Changes

- Add a dedicated global WorkspaceSystem workbench that treats each workspace as one persistent resource comparable to MessageSystem rooms and TerminalSystem terminals.
- **BREAKING** Replace workspace page assumptions that imply multi-root mounts inside one workspace. One workspace SHALL map to exactly one directory root; path-level permissions exist inside that root.
- Add a workspace workbench content model with `Explorer / Rules / Private` as peer modes, a shared page-content header, a single-surface explorer, and a preview/inspector right drawer.
- Add a dedicated `Rules` mode for full rule catalog browsing and management, while the `bottom-area` in `Explorer` becomes a quick-rule editor for only the selected path.
- Add a `Private` mode that reuses the file-list mental model without permission badges and without rule-management actions in the bottom area.
- **BREAKING** Refine the Avatar detail shell so the primary runtime tabs become `Heartbeat / Attention / Settings`, default to `Heartbeat`, and remove `Cycles / OpenTelemetry` from the main path.
- Add a `Heartbeat` runtime surface that renders the session AI-call ledger as one long user/assistant stream backed by `message_parts + ai_call`.
- Keep `Attention` as the obligation and notification surface, with quick actions remaining inside Attention rather than becoming a separate page or generic devtools dashboard.
- Remove telemetry from the primary Avatar detail shell; future deep technical tooling will live in dedicated follow-up surfaces instead of the core runtime tab set.
- Record large-tree interaction constraints for the workspace explorer, including disclosure state, virtualization, and `load more` behavior for oversized directories.

## Capabilities

### New Capabilities
- `workspace-system-workbench`: global workspace workbench behavior, including shared content header, `Explorer / Rules / Private` modes, quick-rule editing, private asset browsing, preview/inspector drawer behavior, and durable workspace persistence cues.

### Modified Capabilities
- `workspace-runtime-shell`: refine the Avatar detail shell so it becomes a global runtime workbench with `Heartbeat / Attention / Settings`, defaults to `Heartbeat`, keeps notification actions inside Attention, and aligns with the shared scaffold and shell laws used by the new workspace workbench.
- `workspace-devtools-surface`: remove cycle and telemetry inspection from the primary Avatar detail tab set and reserve deeper technical tooling for secondary or future dedicated surfaces.

## Impact

- Affected code is concentrated in `packages/webui`, especially workbench routing, left-sidebar projections, window shell composition, workspace surfaces, avatar runtime surfaces, and related view-model selectors.
- Affected contracts include runtime/workspace page composition, mode switching, `View as` avatar switching, right-drawer behavior, frontend interpretation of workspace persistence / permission state published by the backend, and Avatar detail hydration from the new session AI-call ledger.
- This change depends on the backend contracts produced by the archived `refactor-workspace-system-and-attention-core` change and should not reintroduce compatibility glue for the old workspace-local UI model.

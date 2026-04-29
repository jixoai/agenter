## Why

The WebUI has a durable runtime skill system and objective on-disk skill roots, but it still lacks a dedicated Skills workbench that lets operators inspect shared, built-in, global, and avatar-scoped skills through the same shared chrome law as the other primary systems. The new workbench needs a read-only browser surface that stays faithful to real filesystem facts instead of rebuilding a fake tree in feature code. After the initial landing, the inheritance law also needs one destructive correction so the order, route defaults, and backend precedence all match the real skill override model.

## What Changes

- Add a new primary `Skills` destination to the Svelte WebUI shell.
- Add a fixed Skills catalog tab whose `page-tabs` are `shared`, `built-in`, `global`, and `avatars`, with `shared` as the canonical default route and `view=avatar` redirected to `view=avatars`.
- Add a browser-facing read-only skill browser surface that lists visible skills, returns objective file trees for each skill directory, and returns bounded file preview payloads without exposing arbitrary writes.
- Render `built-in`, `shared`, and `global` as accordion-based list-detail views where each skill item expands into a `FileTreeView` and file selection opens a shared detail preview.
- Render `avatars` as an avatar catalog whose detail preview shows workspace-grouped avatar-private skill roots; opening an avatar creates a dedicated workbench tab that browses that avatar's skills by workspace.
- Add an isolated `filePreviewer` entry as the universal file preview shell so every skill file preview stays inside one bounded iframe runtime while concrete renderers remain pluggable.
- Correct runtime skill precedence so visible skills resolve as `shared < built-in < global < avatar-private`, which allows user/global files to override built-ins without collapsing avatar-private roots into the generic catalog.
- Add typed client facades, BDD tests, Storybook DOM coverage, and desktop/mobile browser walkthrough coverage for the new Skills workbench.

## Capabilities

### New Capabilities
- `runtime-skill-browser-surface`: Browser-facing read-only skill tree and file preview surface for shared, built-in, global, and workspace-grouped avatar-private skill roots.
- `skills-workbench`: Primary Skills workbench chrome, page-tabs, avatar overview, dedicated avatar skill tabs, and objective file preview behavior.

### Modified Capabilities
- `svelte-webui-platform`: The primary shell navigation changes from four durable destinations to five by adding `Skills`.
- `workbench-tabs`: Shared workbench chrome must support the Skills catalog tab plus dynamic avatar skill tabs inside the same primary window law.
- `client-runtime-store`: The client runtime facade gains typed read-only skill browser methods without synthesizing file truth into ad hoc feature-owned transports.

## Impact

- `packages/app-server`: read-only skill browser control plane, workspace/avatar grouping logic, and preview classification.
- `packages/client-sdk`: typed skill browser contracts and runtime store wrappers.
- `packages/webui`: new Skills workbench routes, shared file tree/detail projections, `filePreviewer` universal preview entry with CodeMirror/pdf/media renderers, tests, and browser walkthrough evidence.
- Durable docs/specs: `SPEC.md`, `DESIGN.md`, and the affected OpenSpec capability specs.

## Why

The current runtime shell still uses a local `Scaffold` header and leaves `Heartbeat`, `Attention`, and `Settings` competing for vertical space inside the page body. That breaks the shared workbench law already used by `Workspaces` and `Messages`, and it keeps the primary runtime surface from showing the durable Heartbeat stream as the main story.

We need to correct this now because Heartbeat has become the operator's first debugging surface. As long as the shell chrome stays duplicated and the timeline lacks a proper footer statusbar plus long-list virtualization, real AI inspection will remain cramped, inconsistent, and harder to trust.

## What Changes

- **BREAKING** Rebuild the runtime detail shell on top of the shared `WorkbenchWindow + WorkbenchPageToolbar` layout instead of the current runtime-local `Scaffold` header.
- Move the runtime title, status, start/stop action, and `Heartbeat / Attention / Settings` chrome into the workbench toolbar so the page body is reserved for runtime content.
- Upgrade `Heartbeat` into a workbench-native conversation surface with a fixed footer statusbar, compact boundaries rendered as checkpoints, tool activity rendered through `Tool`, and thinking rendered through `Reasoning`.
- Add a virtualized Heartbeat conversation adapter so long durable message-part streams remain responsive without changing the underlying Heartbeat truth model.
- Add footer status signals for the Heartbeat surface, including the latest model-call context usage and an animated attention-state summary while an AI call is in flight.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-runtime-shell`: the runtime workbench shell now uses shared page-toolbar chrome, and the `Heartbeat` tab gains a virtualized conversation body plus a persistent footer statusbar for runtime context and attention signals.

## Impact

- Affected code is concentrated in `packages/webui`, especially the runtime shell, Heartbeat stage, local ai-elements primitives, and runtime stories/tests.
- Affected frontend behavior includes runtime tab chrome placement, Heartbeat scrolling ownership, compact-boundary presentation, tool/thinking rendering, and footer status visibility.
- No durable storage or transport schema changes are intended; existing runtime publication for Heartbeat rows, model calls, and attention focus state is reused.

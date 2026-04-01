## Why

The current terminal UI still mixes workspace-era assumptions, incomplete activity projection, and terminal-wide focus controls that should instead belong to individual users/seats. The Svelte WebUI needs a proper terminal-system surface that treats terminals as global shared systems with explicit user access, actions, and per-user focus state.

## What Changes

- Build a dedicated `/terminals` system surface around global terminals rather than workspace-owned terminal pages.
- Render terminal transcript plus an `Actions / Users` side panel, with tool-call controls at the bottom of the actions view.
- Require actor selection for terminal tool calls and access mutations, using auth/profile-backed identities.
- Move focus/unfocus from terminal-global controls to per-user seat state, which then drives attention injection semantics.
- Make terminal detail resilient to refresh by loading durable transcript/activity state and showing full absolute `cwd` metadata.

## Capabilities

### New Capabilities
- `terminal-system-surface`: Define the global terminal operator surface, access management, action timeline, and per-user focus model in WebUI.

### Modified Capabilities
None.

## Impact

- Affected packages: `@agenter/webui`, `@agenter/client-sdk`
- Affected systems: terminal-system, auth-system, attention injection affordances
- Affected UX: terminal list/detail, access management, per-user focus controls, terminal tool-call actions

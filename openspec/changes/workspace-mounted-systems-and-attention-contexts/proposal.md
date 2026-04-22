## Why

The current runtime still centralizes system CLI, credentials, and AttentionContext publication inside the avatar root workspace. That is truthful for today, but it is not the desired long-term law.

The user wants mounted workspaces to become file-first system carriers:

- a mounted workspace can expose `settings.local.json`
- those settings can provide tokens/secrets for one or more Systems
- those Systems can instantiate themselves from file-backed truth
- those Systems can publish or update AttentionContexts through the shared attention law
- unmounting a workspace should mute the related AttentionContexts instead of destroying their history
- remounting should let the AI or shell reactivate/replan those muted contexts

This is larger than the current shell refactor because it involves secret ownership, System lifecycle, context mounting/muting semantics, and how file-backed System instances cooperate with attention.

## What Changes

- Introduce file-backed mounted workspace system discovery, starting from `settings.local.json`.
- Let mounted workspaces instantiate System adapters from declared settings/tokens rather than from root-only global runtime injection.
- Allow Systems to publish AttentionContexts dynamically when the workspace is mounted.
- Mute or suspend those AttentionContexts when the workspace is unmounted, without deleting durable history.
- Allow remount + shell/runtime control to reactivate or replan muted workspace-backed contexts.
- Revisit whether `root_bash` can eventually collapse into a more uniform workspace-first shell law once secret/control-plane ownership is no longer root-only.

## Capabilities

### New Capabilities
- `workspace-mounted-system-contexts`: mounted workspaces can instantiate System adapters from file-backed settings and dynamically contribute AttentionContexts.

## Impact

- Affected systems: workspace settings loading, secret/token ownership, System lifecycle, attention context lifecycle, workspace mount/unmount handling, and possibly the future shell/tool law.
- This change is intentionally recorded separately from the current `workspace-first-runtime-tool-surface` implementation.

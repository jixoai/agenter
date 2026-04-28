## Why

`root_bash` still rebuilds a fresh `just-bash` instance on every call. That contradicts the intended `root-workspace` law, wastes work on repeated filesystem/command bootstrap, and leaves the codebase with a legacy architecture even though `just-bash` already supports isolated per-`exec()` shell state on top of one shared, dynamically updateable world.

We need to align the implementation with the platform model we already want: `root-workspace` is a durable avatar-private shell world, while `public-workspace` and `terminal` remain collaboration-oriented surfaces with different env/CLI semantics.

## What Changes

- Replace the legacy per-call `root_bash` bootstrap with one durable `just-bash` world owned by the session runtime.
- Keep `root-workspace` as the only surface that rewrites `HOME` and mounts avatar-private runtime CLI/env by default.
- Keep `public-workspace` and `terminal` on collaboration semantics; they must not inherit root-exclusive env/CLI automatically.
- Dynamically refresh mounted workspaces, grants, hidden paths, and runtime skill mounts inside the durable root world without rebuilding the whole shell host.
- Add focused tests and clarifying comments so the singleton shell world remains safe to evolve.
- **BREAKING**: remove the old per-call root-workspace shell construction path instead of leaving both architectures alive.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-system-capabilities`: `root-workspace` must become a durable `just-bash` world whose mounts and overlay rules can refresh without recreating the host shell.
- `workspace-resource-ownership`: root/public/terminal ownership language must explicitly separate root-only env/CLI semantics from collaboration-oriented surfaces.
- `runtime-terminal-contract`: shared terminals must stay outside root-workspace-exclusive env/CLI even after root-workspace moves to a durable singleton world.
- `runtime-skills-cli-surface`: `root_bash` must remain the root-exclusive runtime CLI surface while its implementation changes from per-call construction to session-owned durable execution.

## Impact

- Affected code: `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/workspace-system/root-exec.ts`, runtime shell/skill helpers, and related tests.
- Affected docs/specs: root/public/terminal durable laws in OpenSpec and package specs/comments.
- Dependencies: relies on `just-bash` dynamic `MountableFs` mount/unmount behavior and `OverlayRuleFs` runtime config replacement.

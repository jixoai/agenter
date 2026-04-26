## Why

The runtime currently leaks root-workspace semantics into surfaces that are supposed to stay collaborative, especially shared terminals. That leak is visible in `HOME`, in root-only CLI/env injection, and in the lack of an explicit root-workspace versus public-workspace distinction across code, comments, and workspace UI.

## What Changes

- Make `root-workspace` and `public-workspace` explicit semantic terms in runtime code, comments, and shell/tool descriptions.
- Restrict root-only env and CLI semantics to the fixed `root_bash` / root-workspace surface.
- Stop injecting root-workspace `HOME`, root-only CLI mounts, and avatar-private control-plane env into runtime-created or recovered shared terminals by default.
- Keep `workspace_bash` a pure public-workspace shell that does not synthesize root-home semantics and does not mount root-workspace-exclusive CLI helpers.
- Clarify that `terminal` and `public-workspace` are collaboration surfaces that may be used by multiple avatars, while `root-workspace` differs only by env/CLI semantics rather than by an absolute ban on sharing or visitation.
- Update the workspace workbench so the UI explicitly distinguishes root-workspace versus public-workspace semantics without implying that root-workspace is unshareable.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `runtime-skills-cli-surface`: clarify that `root_bash` is the only shell surface that rewrites `HOME`, while `workspace_bash` remains a pure mounted-workspace shell.
- `runtime-terminal-contract`: require shared terminal creation/recovery to preserve collaboration-safe terminal semantics and never inherit root-workspace env/CLI by default.
- `workspace-resource-ownership`: reinforce that global terminals are shared cross-workspace resources and must not inherit ownership semantics from any one workspace root.
- `workspace-system-capabilities`: make root-workspace versus public-workspace shell semantics explicit, including where root-only CLI mounts are legal.
- `workspace-system-workbench`: require workspace UI to distinguish root-workspace versus public-workspace semantics without turning that distinction into a hard ownership wall.

## Impact

- `packages/app-server/src/session-runtime.ts`
- `packages/app-server/src/runtime-shell-bin.ts`
- `packages/app-server/src/workspace-system/exec.ts`
- `packages/app-server/src/workspace-tool-provider.ts`
- `packages/terminal-system/src/terminal-control-plane.ts`
- `packages/terminal-system/src/managed-terminal.ts`
- `packages/terminal-system/src/pty.ts`
- `packages/webui/src/lib/features/workspaces/*`
- `openspec/specs/runtime-skills-cli-surface/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/workspace-resource-ownership/spec.md`
- `openspec/specs/workspace-system-capabilities/spec.md`
- `openspec/specs/workspace-system-workbench/spec.md`

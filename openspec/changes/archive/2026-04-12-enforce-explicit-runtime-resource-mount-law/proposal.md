## Why

The runtime currently violates the platform law that Avatars are global identities and that rooms, terminals, and workspaces are separately mounted resources. `app-server` still auto-attaches a bootstrap workspace with full grants, auto-allocates and ensures a primary room, and auto-creates configured terminals during runtime boot, which makes cold start, recovery, and real-provider validation depend on hidden defaults instead of durable facts.

This must be corrected now because the ongoing multi-Avatar validation is exposing exactly that ambiguity: tests cannot reliably distinguish “explicitly mounted then restored” from “silently injected at boot”, and dynamic `terminal_create` can still fall back to `homedir()` when no `cwd` is supplied.

## What Changes

- **BREAKING** Remove implicit runtime boot mounts for rooms, terminals, and workspaces. A fresh runtime boot SHALL start with no attached resource unless code explicitly mounted it beforehand or durable attachment facts require recovery.
- **BREAKING** Split cold boot from recovery boot. Recovery SHALL rebuild attached room / terminal / workspace references only from durable grants, tokens, mount records, and attention context, not from startup defaults.
- **BREAKING** Stop treating session bootstrap `cwd` / `workspacePath` as an automatic runtime workspace grant. Workspace access SHALL flow only through explicit `WorkspaceSystem` mounts and grants.
- **BREAKING** Stop auto-creating or auto-focusing terminals from session config at runtime boot. Terminals SHALL appear only when explicitly attached/restored or when the AI calls terminal tooling to create them.
- **BREAKING** Stop auto-ensuring a default chat channel at runtime boot. Room access SHALL be explicit or restored from durable room bindings.
- Tighten dynamic terminal creation so an omitted `cwd` no longer falls back to the user home directory. The runtime SHALL resolve it from explicit mount context or reject creation with a clear error.
- Update the real multi-Avatar validation harness to explicitly orchestrate room grants, workspace mounts, and terminal expectations under the new law.

## Capabilities

### New Capabilities
- `runtime-resource-mount-law`: defines explicit mount vs recovery semantics for runtime-attached rooms, terminals, and workspaces, with attention context acting as the recovery index instead of boot-time defaults.

### Modified Capabilities
- `workspace-system-capabilities`: runtime workspace access no longer comes from bootstrap session creation; it must come from explicit mounts and grants that can later be restored.
- `room-session-projection`: runtime room attachment and recovery can no longer rely on an implicitly ensured default room at startup.
- `runtime-terminal-contract`: runtime terminal attachment can no longer rely on boot-created defaults, and dynamic terminal creation without `cwd` must not escape to `homedir()`.

## Impact

- Affected code: `packages/app-server/src/app-kernel.ts`, `packages/app-server/src/session-runtime.ts`, `packages/app-server/src/session-config.ts`, `packages/app-server/src/workspace-system/*`, real harnesses, and real-provider validation tests.
- Affected APIs: runtime boot behavior, workspace grant/mount behavior, room/terminal attachment semantics, and terminal tool defaults.
- Affected operations: cold start, stop/start recovery, explicit test orchestration, and AI-created terminal sessions.

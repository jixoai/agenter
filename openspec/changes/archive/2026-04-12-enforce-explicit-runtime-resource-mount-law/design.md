## Context

`app-server` currently mixes three different concerns that should be orthogonal:

- Avatar runtime identity bootstrap
- cross-system resource attachment (`Room`, `Terminal`, `Workspace`)
- recovery after stop/start

Today the runtime still injects resources during boot:

- `AppKernel.createSession()` calls `ensureRuntimeWorkspaceAccess()` and grants `/` as `rw`
- `AppKernel.createSession()/startSession()` binds and ensures a primary room
- `SessionRuntime.start()` calls `ensureDefaultChatChannel()`
- `SessionRuntime.start()` auto-creates configured terminals and auto-focuses them
- dynamic `terminal_create` still allows `cwd` omission and the terminal control plane falls back to `homedir()`

That behavior conflicts with the intended platform law:

- fresh runtime boot starts empty
- resources exist only after explicit mount / grant / attach
- recovery rehydrates only previously attached resources from durable facts
- `AttentionContext` helps recovery find what mattered, but it does not mint permissions by itself

## Goals / Non-Goals

**Goals:**
- Make cold boot and recovery boot obey different, explicit rules.
- Remove implicit boot attachment of rooms, terminals, and workspaces.
- Treat workspace access as a `WorkspaceSystem` fact, not as a side effect of `session.cwd`.
- Make dynamic terminal creation resolve `cwd` from explicit mount context or fail clearly.
- Update real-provider validation harnesses so tests explicitly orchestrate mounts, grants, and focus.

**Non-Goals:**
- Do not redesign Avatar identity, principal allocation, or room/terminal authorities.
- Do not make terminal shell process state fully durable across restart in this change.
- Do not preserve backward-compatible “magic defaults” for old tests or call paths.

## Decisions

### 1. Split runtime bootstrap metadata from runtime resource ownership
`session.cwd` and `session.workspacePath` remain bootstrap metadata for config resolution and user-facing provenance, but they SHALL NOT imply an attached runtime workspace or a root `rw` grant.

Alternative considered:
- keep auto-attaching the bootstrap workspace as a convenience default.

Why not:
- it collapses “identity boot” and “resource mount” into one hidden step and makes tests unable to prove explicit orchestration.

### 2. Cold boot creates no default room or terminal attachments
Runtime start SHALL stop calling default room / terminal ensure paths for fresh boot. If no durable attachment exists, the runtime starts with no room attached, no terminal attached, and no workspace access.

Alternative considered:
- preserve a hidden private room / default terminal but mark them as system-managed.

Why not:
- they remain hidden topology and still violate the explicit mount law.

### 3. Recovery restores references from durable authorities, with attention as index
Recovery SHALL use each system's durable facts as the permission source:

- workspace: `WorkspaceSystem` mount + grant records
- room: durable room binding / grant / token facts
- terminal: durable terminal attachment / grant facts

`AttentionContext` is the recovery index that tells the runtime which previously attached resources still matter, but it SHALL NOT act as the permission authority by itself.

Alternative considered:
- use attention snapshot as the sole recovery source.

Why not:
- attention owns engagement state, not permissions; a context can outlive or out-drift a grant.

### 4. Dynamic terminal creation without `cwd` resolves from explicit mount context only
For AI-created terminals:

- if `cwd` is provided, the runtime validates it against explicit mounted workspace grants
- if `cwd` is omitted and exactly one mounted workspace is available as the current terminal root candidate, use that workspace root
- otherwise reject terminal creation with a clear error instead of falling back to `homedir()`

Alternative considered:
- always require `cwd`.

Why not:
- single-workspace sessions are a common valid case, and the runtime can resolve them deterministically once mount law is explicit.

### 5. Terminal recovery restores attachment state, not shell internals
TerminalSystem remains the authority for whether a terminal process is still alive and what its current snapshot is. Runtime recovery only reattaches to the terminal reference and republishes state so the AI can inspect it. Process-context recovery remains an AI/tooling workflow aided by terminal state publication and help docs such as `man/claude.md`.

Alternative considered:
- persist shell process memory and foreground job context as runtime durability.

Why not:
- that is a deeper terminal-system concern and would hide the actual recovery contract the AI must reason about.

### 6. Real-provider scenarios must orchestrate mounts explicitly
Real harnesses and integration tests SHALL explicitly:

- mount/grant workspaces
- grant/focus rooms
- let the AI create terminals explicitly or create them in harness code as an explicit orchestration step

Tests may not rely on session boot side effects to obtain these resources.

## Risks / Trade-offs

- [Existing tests and UI flows rely on hidden defaults] → update them to explicit mount/grant/focus orchestration and keep failure messages specific.
- [Some old persisted sessions contain previously auto-created room/terminal facts] → recovery validates current durable grants and ignores missing/invalid attachments instead of re-synthesizing them.
- [Single-workspace terminal resolution may still be ambiguous in multi-mount cases] → reject with a clear error and force explicit `cwd`.
- [Removing boot defaults may expose more “empty runtime” states in UX] → that is intentional; surfaces should render unattached state honestly instead of depending on hidden bootstrap artifacts.

## Migration Plan

1. Remove runtime boot helpers that silently attach workspaces, rooms, or terminals.
2. Add explicit recovery composition from durable workspace / room / terminal facts plus attention index.
3. Tighten dynamic terminal `cwd` resolution.
4. Rewrite real harnesses to mount/grant/focus resources explicitly.
5. Re-run real-provider validation under the new law.

Rollback strategy:
- none planned; this is a deliberate breaking-law correction.

## Open Questions

- None for this change. Terminal process-context persistence remains a separate terminal-system evolution topic.

## Context

The runtime already documents three distinct shell/process surfaces:

- `root-workspace`: avatar-private shell semantics, root-exclusive runtime CLI/env, `HOME` rewritten to the avatar root workspace.
- `public-workspace`: collaboration-oriented workspace shell semantics, no automatic root-exclusive env/CLI.
- `terminal`: shared durable process semantics, aligned with `public-workspace` rather than `root-workspace`.

The implementation does not fully honor those laws yet. `SessionRuntime.execRootWorkspaceBash()` still delegates to `executeRootWorkspaceBash()`, which rebuilds a fresh `Bash`, `MountableFs`, workspace overlays, and root CLI command set on every call. That keeps behavior technically correct in simple cases, but it preserves a legacy architecture, repeats bootstrap work unnecessarily, and makes it harder to reason about long-lived root-workspace state.

Local verification showed that `just-bash` already supports the architecture we want:

- `exec()` isolates shell state per call.
- The `Bash` instance shares filesystem and command registry across calls.
- `MountableFs` supports dynamic `mount()` and `unmount()`.
- `OverlayRuleFs` supports runtime `replaceConfig()` / `setRules()`.

## Goals / Non-Goals

**Goals:**

- Make `root-workspace` a session-owned durable `just-bash` world.
- Keep `root_bash` one-shot at the shell-state layer while reusing one shared filesystem/mount/command world.
- Refresh workspace mounts, grants, hidden paths, and runtime skill mounts without rebuilding the root shell host.
- Preserve the existing root/public/terminal semantic split and make it explicit in code comments.
- Remove the legacy per-call root-workspace shell construction path entirely.
- Add enough tests to make future regressions obvious.

**Non-Goals:**

- Redesign `workspace_bash` into a durable singleton in this change.
- Change the direct model tool surface (`workspace_list`, `root_bash`, `workspace_bash`).
- Turn shared terminals into avatar-private surfaces or rewrite their `HOME` semantics.
- Expand filesystem authority beyond the runtime's existing mount and grant model.

## Decisions

### 1. `SessionRuntime` will own one lazy `RootWorkspaceShellWorld`

The runtime will construct the root shell world after runtime-local API startup is available, because root-exclusive CLI commands depend on runtime-local API credentials. That world will hold:

- one `MountableFs`
- one durable `Bash`
- stable root mount + dynamic workspace/skill mount registry
- reusable root-exclusive runtime CLI commands

Rejected alternative: continue rebuilding `Bash` on every `root_bash` call. This keeps legacy architecture alive, repeats work every call, and ignores the dynamic FS model that `just-bash` already provides.

### 2. Dynamic authorities will refresh by mutating the durable world, not by replacing it

Before each `root_bash` execution, the runtime will synchronize current workspace authorities and runtime skill mount roots into the existing shell world:

- add newly visible mounts
- unmount removed mounts
- update existing `OverlayRuleFs` configs when grants or hidden paths change
- keep read-only skill mounts aligned with the latest visible roots

Rejected alternative: rebuild the whole world whenever authorities change. This collapses back into the same bootstrap-heavy design we are removing.

### 3. `root-workspace` remains the only root-exclusive env/CLI profile

The durable world changes implementation, not semantics. `root-workspace` still owns:

- avatar-root `HOME`
- root-exclusive runtime CLI/env
- avatar-private root workspace path authority

`public-workspace` and `terminal` remain collaboration-oriented surfaces. They must not inherit root-exclusive env/CLI merely because the same runtime also owns a root-workspace shell world.

### 4. Refresh + exec will run under one runtime-local critical section

The durable world introduces shared mutable shell infrastructure. To keep refresh and execution deterministic, `root_bash` will serialize world refresh and `bash.exec()` behind a small async critical section inside the runtime-owned shell world.

Rejected alternative: rely on opportunistic concurrent safety. Simple concurrent `just-bash` execs worked in local experiments, but dynamic mount/config mutation during overlapping calls is exactly the kind of subtle bug this change should prevent.

### 5. Comments and specs will describe semantic ownership, not implementation accidents

The code will explicitly say:

- `root-workspace` and `public-workspace` are semantic surfaces, not synonyms.
- `root-workspace` may be visited or shared socially, but only it gets the root-exclusive env/CLI profile by default.
- shared terminals follow `public-workspace` semantics even when their cwd points into the avatar root workspace.

## Risks / Trade-offs

- [Risk] Shared mutable shell infrastructure could leak stale mounts or rules. → Mitigation: refresh before every exec, keep mount registries explicit, and add mount/rule refresh tests.
- [Risk] Serializing `root_bash` calls could reduce theoretical parallelism. → Mitigation: `root_bash` is a one-shot control surface; avoiding world corruption is more important than speculative overlap, and the durable bootstrap still removes repeated initialization cost.
- [Risk] Runtime-local API lifecycle changes could stale root CLI command bindings. → Mitigation: create the world only after API startup and keep the current runtime-local API lifecycle contract unchanged in this change.
- [Risk] Legacy helper functions may survive in dead code and confuse future maintainers. → Mitigation: delete the old per-call root-world construction path instead of keeping compatibility branches.

## Migration Plan

1. Add the durable root shell world abstraction and wire it into `SessionRuntime`.
2. Delete the old per-call root-workspace `Bash` construction path.
3. Update specs/comments to reflect the root/public/terminal law precisely.
4. Run focused tests for exec isolation, dynamic mount/rule refresh, and semantic regressions.

## Open Questions

- None for this change. The main architecture choice has already been validated against `just-bash` behavior and selected explicitly.

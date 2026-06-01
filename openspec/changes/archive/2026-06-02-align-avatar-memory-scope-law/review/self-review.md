# Self Review: align-avatar-memory-scope-law

Generated: 2026-05-31 12:16:50 +0800

## Verdict

The implementation now matches the selected law after cleanup: Shell has no app-owned Memory pack path. Shell's default prompt is still addressed by `avatarPrincipalId` under the global Avatar principal root, while durable raw recording belongs to NoteSystem through active `AVATAR_HOME`. WorkspaceSystem private memory remains an explicit overlay/tool artifact.

Follow-up project-hard-code audit also removed remaining app/runtime/session API residue that still exposed project workspace as assistant/session identity authority.

## Plan Alignment

- `@agenter/app-runtime` no longer exposes an app-owned memory-pack schema or type.
- `@agenter/app-server` no longer exposes an app-runtime route that writes app-owned memory role files.
- `@agenter/client-sdk` no longer exposes an app-owned memory-pack facade.
- `apps/shell` only seeds the missing `AGENTER.mdx` wrapper and teaches NoteSystem recording through `ShellAssistant.mdx`.
- `apps/shell` and `apps/shell-old` no longer pass `workspacePath` to assistant ensure or `workspacePath + avatarNickname` to runtime clear; clear uses `avatarPrincipalId`.
- `@agenter/app-server` now names session identity derivation as Avatar-scoped (`resolveAvatarSessionId`) and removed the internal workspace/avatar lookup wrapper.
- Root workspace discovery now lists active apps explicitly and excludes `packages/*-bak`, so `apps/shell-old` and bak snapshots remain reference code instead of active projects.
- Workspace private text assets remain supported through `WorkspaceSystem` for explicit overlays.
- Durable specs now say project workspace is a tool surface, not the default owner for app-owned prompt or ShellAssistant recording.

## Evidence

Before cleanup, repo-local memory residue existed:

```text
.agenter/avatars/by-nickname/shell-assistant/memory/hosting-objective.md
.agenter/avatars/by-nickname/shell-assistant/memory/pairing-playbook.md
.agenter/avatars/by-nickname/shell-assistant/memory/self-evolution-log.md
.agenter/avatars/by-nickname/shell-assistant/memory/terminal-habits.md
.agenter/avatars/by-nickname/shell-assistant/memory/user-model.md
```

Global prompt roots existed, while the searched global memory files were not present before the new seed route runs:

```text
/Users/kzf/.agenter/avatars/by-principal/0x683fe694c23b7f3af3f76cbb05ca009320e45af2/AGENTER.mdx
/Users/kzf/.agenter/avatars/by-principal/0x888bb66a5ec389d52df0c9ff3e19a61dec890a66/AGENTER.mdx
/Users/kzf/.agenter/avatars/by-principal/0x9eb798d6d2bdea5d434dad84ce014b1fddba2232/AGENTER.mdx
```

Approved cleanup removed repo-local `.agenter/avatars`; follow-up `find .agenter -maxdepth 6` showed no `.agenter/avatars` tree.

## Verification Commands

- `bun test packages/app-runtime/test/app-runtime.test.ts` passed: 16 tests.
- `bun test packages/client-sdk/test/app-runtime.test.ts` passed: 12 tests.
- `bun test packages/app-server/test/session-catalog.test.ts` passed: 4 tests.
- `bun test packages/app-server/test/app-runtime.test.ts` passed: 10 tests.
- `bun test apps/shell/test/run-shell.test.ts` passed: 19 tests.
- `bun run --filter '@agenter/app-server' typecheck` passed.
- `bun run --filter 'agenter-app-shell' typecheck` passed.
- `bun run typecheck` passed after excluding reference/bak projects from workspace discovery.
- `bun run openspec:vision -- validate align-avatar-memory-scope-law` passed.
- `bun run openspec:vision -- check align-avatar-memory-scope-law` passed with `ok: true`.
- `bun run openspec:vision -- status align-avatar-memory-scope-law` showed `research-plan`, `specs`, and `tasks` complete, with only `self-review` pending before this artifact.

## Workspace Project Set

`apps/shell-old` is reference code. It is no longer a workspace package, and `*-bak` package folders are also excluded from Bun and pnpm workspace discovery. The active root typecheck now passes without requiring those reference snapshots to satisfy current product contracts.

## Review Notes

- The change is generic: core/server code has no Shell-specific memory branch.
- Principal id validation is enforced in the shared schema.
- Memory role paths are constrained as safe relative paths in the shared schema and still contained again server-side.
- Existing workspace-private memory APIs are intentionally retained to avoid deleting the explicit overlay tool surface.
- Wider residue scans found no remaining code references to the removed `resolveWorkspaceAvatarSessionId` / `findByWorkspaceAvatar` names or `workspacePath + avatarNickname` reset shape; remaining `workspacePath` usages after this pass are intentional tool surfaces: cwd, mounts, grants, workbench browsing, workspace exec, and explicit private overlays.
- No automatic migration/merge of existing project-local memory content was attempted.

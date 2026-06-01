## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` reflects the relevant Shell bootstrap path, app-runtime contract, app-server path resolution, existing OpenSpec survey, and user Q&A.
- [x] 1.2 Confirm the user selected the NoteSystem recording law and approved current repo-local memory residue cleanup after evidence capture.
- [x] 1.3 Confirm project workspace current repo truth: it remains a mount/cwd/grant/workbench/exec tool surface and is not a runtime identity axis.
- [x] 1.4 An agent may only check off future tasks it completed and verified in the current working context.

## 2. BDD Contract

- [x] 2.1 Add app-runtime schema/unit BDD proving app assistant creation and runtime clear reject project workspace authority.
- [x] 2.2 Add client-sdk BDD proving Shell prompt seed stays global Avatar principal-root and does not create app-owned recording files.
- [x] 2.3 Add app-server BDD proving workspace-local memory residue remains untouched unless explicit WorkspaceSystem private asset APIs are used.
- [x] 2.4 Add Shell bootstrap BDD: Scenario: Given Shell starts from a project workspace When default assistant resources are ensured Then prompt uses the session `avatarPrincipalId` and no default memory files are created.
- [x] 2.5 Keep workspace-private asset BDD: Scenario: Given explicit workspace private memory ensure When called through WorkspaceSystem Then project-local private memory still works as an explicit overlay.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check align-avatar-memory-scope-law --phase apply` before app-code work starts and record the result.
- [x] 3.2 Remove app-runtime app-owned memory-pack schema/API surface.
- [x] 3.3 Remove app-server app-owned memory-pack implementation and tRPC route.
- [x] 3.4 Remove client-sdk app-owned memory-pack facade and types.
- [x] 3.5 Keep workspace-private text asset APIs as the only explicit workspace-scoped memory overlay path.
- [x] 3.6 Update `apps/shell` bootstrap and test fakes so Shell only seeds missing prompt defaults and creates no default memory files.
- [x] 3.7 Update Shell prompt wording so NoteSystem is the default durable raw-recording surface.
- [x] 3.8 Update durable specs (`SPEC.md`, `packages/app-runtime/SPEC.md`, and any package SPEC needed) so app-owned recording truth is NoteSystem and project workspace stays a tool surface.
- [x] 3.9 Capture current repo-local `.agenter/avatars/.../memory` residue evidence, delete the approved repo-local residue, and verify global memory seed paths exist or are ready to be seeded.

## 4. Verification

- [x] 4.1 Run targeted app-runtime package tests.
- [x] 4.2 Run targeted client-sdk app-runtime tests.
- [x] 4.3 Run targeted app-server app-runtime tests.
- [x] 4.4 Run targeted Shell bootstrap/runtime tests.
- [x] 4.5 Run `bun run openspec:vision -- validate align-avatar-memory-scope-law`.
- [x] 4.6 Run `bun run openspec:vision -- status align-avatar-memory-scope-law` and confirm specs/tasks are recognized.

## 4.7 Project Hard-Code Residue Audit

- [x] 4.7.1 Audit app/runtime/session API shapes for remaining project-workspace authority residue after the NoteSystem recording cleanup.
- [x] 4.7.2 Update assistant ensure contract so app-owned Avatar creation accepts Avatar catalog fields only, not `workspacePath`.
- [x] 4.7.3 Update runtime clear contract and client behavior so reset authority is `avatarPrincipalId`, not `workspacePath + avatarNickname`.
- [x] 4.7.4 Rename server session identity helper to Avatar-scoped naming and remove the internal workspace/avatar lookup wrapper.
- [x] 4.7.5 Add BDD coverage for project-shaped assistant/session inputs being rejected and same-Avatar session catalog identity staying workspace-independent.
- [x] 4.7.6 Run a wider residue scan and classify remaining `workspacePath` usages as cwd, mounts, grants, workbench, exec, or explicit workspace-private overlays.

## 4.8 Reference Project Exclusion

- [x] 4.8.1 Treat `apps/shell-old` as reference code like `*-bak` folders, not as an active workspace project.
- [x] 4.8.2 Replace broad app workspace discovery with explicit active app entries.
- [x] 4.8.3 Exclude `packages/*-bak` and nested bak packages from Bun and pnpm workspace discovery.
- [x] 4.8.4 Refresh lockfiles so `agenter-app-shell-old`, `@agenter/webui-bak`, and `@agenter/web-chat-view-bak` no longer appear as workspace packages.
- [x] 4.8.5 Verify root `bun run typecheck` passes without typechecking old/reference projects.

## 4.9 Builtin Prompt Global Inheritance

- [x] 4.9.1 Record the user decision that daemon startup must overwrite platform builtin prompt files under `~/.agenter/builtin/`.
- [x] 4.9.2 Add BDD coverage proving AppKernel startup materializes builtin prompt docs and overwrites stale builtin files.
- [x] 4.9.3 Add prompt composition coverage proving `AGENTER.mdx` can explicitly inherit daemon-materialized builtin prompts through `global:builtin/$LANG/AGENTER.mdx`, while `super:` stays pure layer inheritance.
- [x] 4.9.4 Update Shell default `AGENTER.mdx` seed to compose `global:builtin/$LANG/AGENTER.mdx` with `app:shell/ShellAssistant.mdx`.
- [x] 4.9.5 Update global runtime prompt guidance so SkillSystem is treated as the documentation center for internal runtime CLI usage.
- [x] 4.9.6 Update durable specs for builtin prompt materialization and Shell prompt composition.
- [x] 4.9.7 Run targeted app-server and shell tests for builtin prompt materialization, prompt-store super inheritance, runtime skill guidance, and shell prompt seed.
- [x] 4.9.8 Update `skills/create-agenter-app` so future app assistant prompt seeds know the `global:builtin/$LANG/AGENTER.mdx` + `app:<app-id>/<file>` composition law.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` as the macro review thinking record comparing implementation against `plans/plan.md`.
- [x] 5.2 Generate separate `review/self-review.html` as the structured evidence presentation for command evidence and cleanup proof.
- [ ] 5.3 If the review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If the review is entering a real loop, run `bun run openspec:vision -- review-state align-avatar-memory-scope-law` to persist iteration / recurrence state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff align-avatar-memory-scope-law` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `openspec archive align-avatar-memory-scope-law` and commit the archive result.
- [x] 5.7 Run `bun run openspec:vision -- check align-avatar-memory-scope-law` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

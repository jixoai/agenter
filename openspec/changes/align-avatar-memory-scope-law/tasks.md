## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` reflects the relevant Shell bootstrap path, app-runtime contract, app-server path resolution, existing OpenSpec survey, and user Q&A.
- [x] 1.2 Confirm the user selected the global Avatar memory-pack law and approved current repo-local memory residue cleanup after evidence capture.
- [x] 1.3 Confirm project workspace current repo truth: it remains a mount/cwd/grant/workbench/exec tool surface and is not a runtime identity axis.
- [x] 1.4 An agent may only check off future tasks it completed and verified in the current working context.

## 2. BDD Contract

- [x] 2.1 Add app-runtime schema/unit BDD: Scenario: Given default app memory-pack seed input includes `workspacePath` When parsed Then the schema rejects project workspace authority.
- [x] 2.2 Add client-sdk BDD: Scenario: Given Shell starts from `/repo` When ensuring the default memory pack Then the client calls the principal-addressed global Avatar memory route and does not call `ensureWorkspacePrivateTextAsset`.
- [x] 2.3 Add app-server BDD: Scenario: Given app-owned memory roles are seeded for a principal When a workspace-local memory residue exists Then role files are created under `~/.agenter/avatars/by-principal/<id>/memory` and workspace residue remains untouched.
- [x] 2.4 Add Shell bootstrap BDD: Scenario: Given Shell starts from a project workspace When default assistant resources are ensured Then prompt and memory pack both use the session `avatarPrincipalId`.
- [x] 2.5 Keep workspace-private asset BDD: Scenario: Given explicit workspace private memory ensure When called through WorkspaceSystem Then project-local private memory still works as an explicit overlay.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check align-avatar-memory-scope-law --phase apply` before app-code work starts and record the result.
- [x] 3.2 Extend `@agenter/app-runtime` with a strict principal-addressed global Avatar memory-pack seed schema and output-neutral role contract.
- [x] 3.3 Add app-server generic global Avatar memory seed implementation under the global Avatar principal root, with seed-if-missing and path traversal rejection.
- [x] 3.4 Expose the global memory seed through the `appRuntime` tRPC router and client-sdk runtime store.
- [x] 3.5 Update `AppRuntimeClient.ensureMemoryPackIfMissing` to use `avatarPrincipalId` and remove default memory-pack dependency on `workspacePath + avatarNickname`.
- [x] 3.6 Update `apps/shell` bootstrap and test fakes so Shell passes session `avatarPrincipalId` for default memory pack initialization.
- [x] 3.7 Update Shell prompt wording so Memory pack explicitly points at global Avatar memory roles, while workspace-private memory remains an explicit overlay/tool concept.
- [x] 3.8 Update durable specs (`SPEC.md`, `packages/app-runtime/SPEC.md`, and any package SPEC needed) so app-owned memory-pack truth is global principal-root memory and project workspace stays a tool surface.
- [x] 3.9 Capture current repo-local `.agenter/avatars/.../memory` residue evidence, delete the approved repo-local residue, and verify global memory seed paths exist or are ready to be seeded.

## 4. Verification

- [x] 4.1 Run targeted app-runtime package tests.
- [x] 4.2 Run targeted client-sdk app-runtime tests.
- [x] 4.3 Run targeted app-server app-runtime tests.
- [x] 4.4 Run targeted Shell bootstrap/runtime tests.
- [x] 4.5 Run `bun run openspec:vision -- validate align-avatar-memory-scope-law`.
- [x] 4.6 Run `bun run openspec:vision -- status align-avatar-memory-scope-law` and confirm specs/tasks are recognized.

## 4.7 Project Hard-Code Residue Audit

- [x] 4.7.1 Audit app/runtime/session API shapes for remaining project-workspace authority residue after the memory-pack fix.
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

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` as the macro review thinking record comparing implementation against `plans/plan.md`.
- [x] 5.2 Generate separate `review/self-review.html` as the structured evidence presentation for command evidence and cleanup proof.
- [ ] 5.3 If the review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If the review is entering a real loop, run `bun run openspec:vision -- review-state align-avatar-memory-scope-law` to persist iteration / recurrence state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff align-avatar-memory-scope-law` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `openspec archive align-avatar-memory-scope-law` and commit the archive result.
- [x] 5.7 Run `bun run openspec:vision -- check align-avatar-memory-scope-law` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

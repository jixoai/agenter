# Intent Document

## Current Round

- Round: 2
- Status: Option A selected by user; project workspace tool-role evidence added; ready to derive specs/tasks.
- Previous plan backup: `plans/plan-v1.md`

## Workflow Command Surface

- Create change: `bun run openspec:vision -- new <change>`
- Check status: `bun run openspec:vision -- status <change>`
- Get artifact instructions: `bun run openspec:vision -- instructions <artifact> <change>`
- Strictly validate change files: `bun run openspec:vision -- validate <change>`
- Check commit evidence: `bun run openspec:vision -- commit-check <change> --phase <phase>`
- Rename after intent realignment: `bun run openspec:vision -- rename <old-change> <new-change>`
- Write abnormal-exit handoff: `bun run openspec:vision -- handoff <change>`
- Final workflow proof gate: `bun run openspec:vision -- check <change>`

## Original User Input

> 我们现在专注于打磨 app/shell 这个产品。从这个产品的打磨作为起点，完善内核，进而完善产品。
>
> ### 关于AGENTER.mdx中这部分：
> ```
> ## Memory pack
>
> Read and update these avatar-private memory roles when the evidence justifies it:
> - `user-model.md` for user-model
> - `pairing-playbook.md` for pairing-playbook
> - `terminal-habits.md` for terminal-habits
> - `self-evolution-log.md` for self-evolution-log
> - `hosting-objective.md` for hosting-objective
> ```
>
> 我怎么感觉这些文件被创建在 project scope avatar workspace，为什么不是global scope avatar workspace?
>
> 更核心的原因是什么？我感觉这里有一些残留的问题。好好调查一下，我们项目经历过复杂的 project/global scope的一些设计改动，可能遗留了一些东西。

> 使用openspec vision进行推进。

> 可以直接清理，关键，现在project workspace这个概念几乎不直接给用了啊
> 目前我们根本不会去硬编码project workspace相关的东西了不是吗？（好好调查这点）
> project workspace现在只是一个“工具”，我们提供一些快捷的使用它们的办法

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | We now focus on polishing `app/shell` as the product entry point, using product polish to improve the kernel and then improve the product. | Scope starts from the Shell product, but the expected repair may belong in the generic app-runtime/kernel law. |
| 2 | User | In `AGENTER.mdx`, the `Memory pack` section lists five avatar-private memory role files. User asks why these appear created in the project-scope avatar workspace instead of the global-scope avatar workspace. | The investigation must trace prompt text, memory seed API, and workspace/global path law rather than only editing the prompt wording. |
| 3 | User | User suspects a deeper residue from earlier complex project/global scope design changes and asks to investigate carefully. | Treat this as architecture archaeology. Distinguish intentional workspace overlays from stale prompt/memory authority. |
| 4 | User | Use OpenSpec vision to proceed. | This change uses the `vision-driven` schema and keeps `plans/plan.md` as the Intent Document SSOT. |
| 5 | User | User approves direct cleanup, and states that `project workspace` is now almost never a directly used product concept; asks to investigate whether the system still hard-codes project-workspace semantics; says project workspace is now only a "tool" with shortcut affordances. | This confirms Option A direction and upgrades the investigation: memory pack must not treat project workspace as a default identity/memory owner. Cleanup is approved after evidence capture. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `apps/shell/src/app-runtime/shell-assistant-seeds.ts` | Current Shell product prompt seed still contains the `Memory pack` section and five role paths as bare filenames. | The user-observed text is live in `app/shell`, not only old cli-shell residue. |
| `apps/shell/src/app-runtime/bootstrap.ts` | Shell seeds `AGENTER.mdx` by principal, then used a legacy memory-pack facade keyed by `workspacePath + avatarNickname`. | Prompt and memory now use two different identity axes. Prompt is principal-addressed global; memory is workspace + nickname addressed. |
| `packages/client-sdk/src/app-runtime.ts` | The legacy memory-pack facade loops roles and calls `store.ensureWorkspacePrivateTextAsset({ workspacePath, avatarNickname, assetKind: "memory", relativePath })`. | The SDK contract hardcodes memory pack seeding as workspace-private text assets. |
| `packages/app-server/src/workspace-workbench.ts` | `ensureWorkspacePrivateTextAsset` writes under `resolveWorkspaceAvatarAssetRoot(workspacePath, avatar, assetKind)`. | The server implementation confirms the memory pack target is the WorkspaceSystem private asset tree. |
| `packages/app-server/src/workspace-system/paths.ts` | `resolveWorkspaceAvatarPrivateRoot(workspacePath, avatar)` returns global avatar root only when `workspacePath` is the global workspace; otherwise it resolves `<workspace>/.agenter/avatars/...`. | This directly explains why launching Shell from a project creates project-scope avatar-private memory files. |
| `packages/app-server/src/app-kernel.ts` | `ensureAvatarPromptSeed` resolves prompt seed through the canonical avatar prompt seed path; it no longer accepts workspace path. | The previous prompt-root cleanup succeeded for `AGENTER.mdx`, but did not cover memory pack ownership. |
| `packages/app-runtime/SPEC.md` | It currently says prompt seed/read identity must be global principal canonical root, while "prompt/memory" seed-if-missing files are avatar-private truth. | Durable spec language is internally ambiguous for memory: global prompt law is explicit; memory root law is not. |
| `openspec/changes/canonicalize-avatar-prompt-global-root/design.md` | That change explicitly lists "Do not redesign memory pack ownership" as a non-goal. | This issue was knowingly left outside the prior prompt-root change. The current symptom is a real remaining design gap, not just implementation drift. |
| `openspec/specs/workspace-resource-ownership/spec.md` | Workspace assets distinguish public assets from workspace avatar-private assets, including skill/memory/tool/archive artifacts. | The existing WorkspaceSystem law intentionally supports project-scoped avatar-private memory overlays. |
| `openspec/changes/archive/2026-04-29-add-skills-workbench/specs/runtime-skill-browser-surface/spec.md` | Runtime skills use visible precedence `shared < built-in < global < avatar-private`; `avatars` browser groups global root plus workspace-private roots. | Skills already have an explicit layered global/workspace-private model; Memory pack does not yet have an equally explicit layer law. |
| Filesystem: `find .agenter ...` | The repo checkout currently has `.agenter/avatars/by-nickname/shell-assistant/memory/*.md` files again. | Workspace-local memory residue has reappeared after the previous `.agenter/avatars` cleanup, likely through current Shell memory seed flow. |
| Filesystem: `find ~/.agenter/avatars ...` | Global avatar principal roots contain `AGENTER.mdx` files, but no matching global memory pack files were found at the searched depth. | The current live filesystem state matches the code path: prompt global, memory project-local. |
| `SPEC.md` | AvatarRuntime identity is avatar-first; workspace membership attaches through WorkspaceSystem mounts and cannot become a runtime identity axis. | Project workspace is already demoted from identity law at the repo-level spec. |
| `packages/app-server/SPEC.md` | `session.workspacePath` only records bootstrap workspace and does not represent the full runtime mount list; current workspace access must be queried through runtime mounts. | Project workspace is a boot/mount/access tool, not the durable Avatar identity or memory owner. |
| `packages/app-server/src/session-identity.ts` | `resolveWorkspaceAvatarSessionId(_workspacePath, avatar)` ignores workspace path and resolves runtime id from Avatar only. | The code path already encodes avatar-first runtime identity despite the legacy function name. |
| `packages/app-server/src/session-catalog.ts` | `findByWorkspaceAvatar(workspacePath, avatar)` delegates to `findByAvatar(avatar)`, while `workspacePath` remains metadata / bootstrap context. | The old `workspace + avatar` API shape is compatibility residue; runtime lookup no longer uses project workspace as identity. |
| `apps/shell/src/app-runtime/runtime.ts` | Shell passes `process.cwd()` as `workspacePath` to bootstrap, and prompt guidance tells the model to use `workspace_bash` only for explicit one-shot workspace inspection or file work outside the visible shell terminal. | The Shell product uses current project workspace as convenience cwd / tool surface, not as assistant memory identity. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not ready; only research-plan is being drafted. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not started. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not started. |
| Normal archive | Commit containing `openspec archive <change>` result | Not started. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not needed yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `canonicalize-avatar-prompt-global-root` | `AGENTER.mdx` runtime truth is global-only: `~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`; memory pack ownership was explicitly non-goal. | Reuse prompt law; extend it to memory or explicitly define a different memory layer law. |
| `workspace-resource-ownership` | WorkspaceSystem owns workspace public assets and workspace avatar-private assets as separate durable domains. | Reuse for project-local overlays only if memory pack remains intentionally workspace-scoped. |
| `add-skills-workbench` archive specs | Skills have explicit layered roots and browser projection: global root plus workspace-private avatar roots. | Reuse the layered model if memory needs both global baseline and project override. |
| `app-runtime/SPEC.md` | App assistant initialization is seed-if-missing; prompt seed/read identity is global principal canonical root; memory root is not explicitly separated. | Modify to remove ambiguity. |
| `complete-cli-shell-avatar-session-reset` | `--clear-avatar` must not delete prompt/memory assets; selected/created Avatar is ordinary and not a special mode. | Preserve. Memory ownership change must not turn shell-assistant into a special Avatar type. |
| `avatar-runtime-topology` main spec | Runtime identity is keyed by Avatar identity alone; workspace membership, room membership, terminal membership, and app-local shell names do not create additional runtime identities. | Extend the same law to app-owned memory pack identity. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `app/shell 这个产品` | Shell is the product surface where the issue is observed and where product polish should expose kernel defects. | Start from Shell behavior, but repair the platform law when the product symptom points to kernel drift. |
| `project scope avatar workspace` | A workspace-local avatar-private root such as `<project>/.agenter/avatars/...`. | Project-local private overlay. |
| `global scope avatar workspace` | The global Avatar canonical root such as `~/.agenter/avatars/by-principal/<principalId>`. | User-level Avatar home. |
| `project workspace现在只是一个“工具”` | Project workspace is a mounted cwd/access/exec surface with shortcuts, not a default owner for Avatar identity memory. | Workspace can still expose Explorer/CLI/private overlays, but Shell memory pack must not be tied to cwd. |
| `残留的问题` | Leftover design/implementation from previous project/global scope transitions. | Architectural drift, not only stale files. |
| `好好调查一下` | Evidence first, source-of-truth archaeology before coding. | Do not guess; trace specs, code, and real filesystem. |
| `openspec vision` | Use `vision-driven` workflow with Intent Document first. | Do not jump directly to patching. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | Current code and tests are enough to establish the path split. | Not needed yet. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should Shell memory pack roles be global Avatar memory by default, with optional project overlays only when explicitly modeled? | This decides whether we perform a platform-law upgrade or only clarify docs/prompt wording. | Yes. The listed roles are user relationship, pairing habits, terminal habits, self-evolution, and hosting objective; most are Avatar identity memory, not project-local workspace artifacts. |
| If existing project-local memory files contain useful user edits, should migration copy/merge them into global memory or only stop future creation and leave cleanup/manual migration to the operator? | Destructive or semantic migration of user memory cannot be assumed. | Do not delete automatically. Add a migration/audit tool or instructions; copy only with explicit user approval. |
| Does current repo truth still hard-code project workspace as a product concept? | User asked to verify, not assume. | Mostly no for runtime identity: project workspace remains as mount/cwd/grant/workbench tooling, but app-runtime memory seed still incorrectly uses it as identity storage. |

## Intent

### Surface Intent

Find why the `AGENTER.mdx` Memory pack files are being created under project-scope avatar workspace paths, decide whether that is valid, and use OpenSpec vision to drive any product/kernel cleanup.

### Underlying Drive

The product symptom exposes a deeper law mismatch:

- Avatar prompt identity has already moved to the global principal root.
- Memory pack seeding still uses WorkspaceSystem private assets selected by `workspacePath + avatarNickname`.
- The Shell prompt says "avatar-private memory roles" without saying whether "avatar-private" means global Avatar home, project-local private overlay, or a layered memory system.

This creates a split-brain mental model. The same Shell Avatar reads a global `AGENTER.mdx`, but the memory files that prompt names are created in whichever project workspace launched Shell. That makes durable user relationship memory depend on launch location.

Round 2 correction from user intent: project workspace should be treated as a tool surface. It can provide cwd, mounts, grants, Explorer/CLI shortcuts, and explicit workspace-private overlays. It should not silently become the owner of default Shell Assistant identity memory.

### Final Visible Effect

When this change is correct, an operator can start `app/shell` from a project and know exactly where Shell Assistant's Memory pack lives:

- Either the memory pack is global Avatar memory under the same global principal-address family as `AGENTER.mdx`;
- Or the UI/prompt/API explicitly calls it a project-local avatar-private overlay and never implies global Avatar memory.

The preferred visible effect is stronger: starting Shell from a regular project no longer recreates `.agenter/avatars/.../memory/*.md` for the default global relationship memory pack. Any project-local memory becomes an explicit override or workspace artifact with its own name and contract.

## Platform Diagnosis

- Current platform laws:
  - `AGENTER.mdx` prompt truth is global-only by principal id.
  - WorkspaceSystem supports workspace public and workspace avatar-private assets.
  - AppRuntime exposes generic seed-if-missing prompt/memory initialization.
  - Skills have explicit layered precedence; memory pack does not.
- Does this fit as a regular atom: no. The symptom is not a new Shell feature; it reveals two ownership laws using the same "avatar-private" label differently.
- Does this require law upgrade: yes, unless the user accepts memory as project-local by design. The law must define whether app-owned memory roles are global Avatar memory, workspace overlay memory, or a layered composition.
- Breaking update stance: user selected the law-upgrade direction and approved cleanup. The current split invites hidden data divergence across projects.
- User confirmations still required:
  - Whether to migrate/copy existing project-local memory into global memory. Default: do not auto-merge.
  - Cleanup of repo-local residue is approved after evidence capture, but automatic deletion of non-repo user global memory remains out of scope.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator starts Shell in `/repo`. Shell ensures `shell-assistant` exists and seeds missing defaults. The operator sees or inspects:

- `AGENTER.mdx` lives under the global Avatar principal root.
- The Memory pack named by `AGENTER.mdx` lives in a predictable matching Avatar memory root.
- If project-local memory exists, it is labeled as a project override or workspace note, not silently treated as the same role.

### Interface Shape

Recommended interface shape:

- Add a generic app-runtime memory seed contract that accepts `avatarPrincipalId` for global Avatar memory roles.
- Stop making app-level memory pack initialization depend on `workspacePath + avatarNickname`.
- If workspace-private memory overlays remain useful, expose them through a distinct API/name such as workspace private memory asset, not as the default app memory pack.

### Data Shape

Facts that must not be confused:

- Global Avatar identity: principal-address root, stable across workspaces.
- Workspace private asset: project-local overlay, isolated per workspace and Avatar.
- Prompt truth: global `AGENTER.mdx`.
- Memory role truth: currently ambiguous; recommended to make Shell's default role files global Avatar memory.
- Migration residue: existing `.agenter/avatars/.../memory/*.md` files are data, not proof of intended current law.

### Architecture Shape

Recommended platform law:

- The legacy app-owned memory-pack facade should be removed; ShellAssistant recording should use NoteSystem instead of app-runtime role files.
- WorkspaceSystem `ensureWorkspacePrivateTextAsset` remains valid for explicitly workspace-scoped private artifacts.
- Project workspace remains a tool surface: cwd, mount, grants, workspace workbench, one-shot exec, and explicit private overlays.
- Shell product supplies role definitions and prompt wording only; it must not know filesystem layout.
- Core/app-server owns path resolution through typed contracts; no Shell-specific path branch belongs in core.

Forbidden couplings:

- No `if app is shell` branch in core.
- No fallback that silently tries project memory then global memory by filename without an explicit layer contract.
- No deletion of user memory files during startup.
- No prompt wording that says "avatar-private" while hiding the scope/layer it means.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Adopt global memory pack law | Changes where future Shell memory roles are seeded and read. | Confirmed by user direction. |
| Migrate existing project-local memory files | Existing files may contain user-authored durable preferences. | Do not migrate or delete automatically. |
| Clean local `.agenter/avatars/.../memory` residue | Cleanup removes local data and affects manual verification. | Approved for current repo-local residue after evidence capture. |

## Architecture Options

### Option A: Paradigm Shift, Recommended

Define app-owned memory roles as global Avatar memory by principal id. Implement a new or modified generic contract parallel to prompt seed:

- Input: `avatarPrincipalId`, role/path/seed content.
- Target: `~/.agenter/avatars/by-principal/<principalId>/memory/<role-path>` or an equivalent global Avatar memory directory.
- Shell bootstrap: pass `avatarPrincipalId`, not `workspacePath + avatarNickname`, for the default Memory pack.
- Prompt wording: say the role files are under the global Avatar memory pack, and name any explicit workspace overlay separately if it exists.
- Specs/tests: prove regular project startup does not create project-local Memory pack files for the default Shell Assistant memory roles.
- Cleanup: remove current repo-local `.agenter/avatars/.../memory` residue only after the new law is encoded and evidence confirms global seed paths.

Why this is first-principles correct:

- User model, pairing playbook, terminal habits, and self-evolution log are identity memory, not project files.
- The same Avatar should not learn a different relationship model merely because Shell was launched from a different repo.
- It completes the previous `AGENTER.mdx` global-root transition instead of preserving a half-global, half-project assistant identity.

### Option B: Technical-Debt / Compromise

Keep current storage and only clarify language:

- Prompt says these files are project-local avatar-private memory assets.
- Tests assert seeding under `<workspace>/.agenter/avatars/.../memory`.
- Maybe add UI/help text explaining that each project has its own Shell Assistant memory pack.

Why this is weaker:

- It makes durable relationship memory fragment by project.
- It contradicts the mental model established by global `AGENTER.mdx`.
- It keeps "avatar-private" overloaded between global Avatar home and project-local overlay.
- It does not answer why these role names look like global assistant identity roles.

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [x] 2. Get user decision on Option A vs Option B.
- [ ] 3. Write specs from the selected intent.
- [ ] 4. Write BDD tasks from specs.
- [ ] 5. Implement tasks.
- [ ] 6. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should the default Shell Memory pack become global Avatar memory? | Determines the platform law and API shape. | Yes, Option A. |
| Should workspace-local memory continue to exist as a layered project override? | Determines whether we need a layered read/composition law now or a narrower seed-target change. | Keep WorkspaceSystem private assets, but do not use them for default Shell identity memory. |
| How should existing project-local memory files be migrated? | User memory is durable data; migration can cause loss or duplication. | Audit first; no automatic deletion. |
| Should project workspace have any default product memory role? | Prevents reintroducing project-scope identity by another name. | No. It remains a tool/mount/cwd surface unless a future explicit project-memory feature is designed. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Patch only `AGENTER.mdx` wording without tracing storage | It hides the real split between prompt and memory authority. |
| Delete `.agenter/avatars` residue immediately | The user asked to investigate; existing memory files may contain useful data. |
| Hard-code Shell in core path resolution | Violates app/runtime orthogonality and repeats the product-specific core pollution this project has been removing. |
| Treat nickname alias as durable memory identity | Previous prompt-root work already made principal id the canonical identity axis; nickname is discoverability only. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2 consecutive review rounds
- Custom exit condition from intent: Shell memory-pack scope is explicit in OpenSpec and durable specs; BDD proves the selected global/project law; app/shell bootstrap and app-runtime contracts follow that law without Shell-specific core branches; any local residue cleanup or migration is handled only with explicit operator approval.

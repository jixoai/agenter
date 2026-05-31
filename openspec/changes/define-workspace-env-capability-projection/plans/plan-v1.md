# Intent Document

## Current Round

- Round: 1
- Status: Env-first workspace capability projection change opened; research artifacts are being prepared before any implementation.
- Previous plan backup: none

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

> 不，接下来我将每一种全新的架构模式，你理解这个架构模式后，重新破坏性更新地整体设计：
>
> 0. 首先 背景知识是，我们的内核是 AttentionSystem，底层唯一的主工具是 workspaceSystem 的 bash 工具
> 1. 我们需要从 env 出发，来重新设计各种内核的工作方式，而不是在代码上硬编码
> 2. 新增 env.AVATAR_HOME="<avatar_root_workspace_path>;[...]" 字段，这个字段决定了一个 workspace 实例的 AVATAR_HOME 定义，通常会直接继承`<avatar_root_workspace_path>`，但不排除某些 workspace 实例不继承`<avatar_root_workspace_path>`，这里取决于 workspace 实例的创建方式。实现灵活的继承配置`workspace.getAvatarHome():string[]`,`workspace.setAvatarHome(paths:string[])`，并通过无副作用的工具层，提供 `parseEnvAvatarHome(envValue?:string): string[]`
> 3. 基于AVATAR_HOME 环境变量，skill-cli 的工作方式就变成了，直接读取当前 avatarHome 的，然后通过我们底层提供的 multi-skill-source 混合算法，实现多路径的技能混合
> 4. 更进一步的，意味着我们在开发 xxxSystem 的时候，定义 xxx-cli 的时候，可以声明：这个 xxx-cli 是否允许注册到 除了 root-workspace 以外的环境。这种允许，还可以进一步演化成一种基于 workspace 声明周期的工具：当一个 workspace 创建的时候，执行 hook，xxx-cli 获得 workspace 实例，检查 workspace 实例是否符合预期，如果符合，那么就声明向这个 workspace 中提供 xxx-cli（当然也可以提供 yyy-cli，或者 ）
> 5. 同理，我们内部应该开发 toolSystem、memorySystem，提供 tool-cli，memory-cli，都是用类似的原理，实现对 tool、memory 的管理, studio 配套提供响应的 router:tools / router:memories
>
> 使用opentray vision 推进并和我展开讨论，确保你完全理解这套架构

> 1: AVATAR_HOME 的规范类似 PATH的规范，后者覆盖前者
> 2: 是的，只能绝对
> 3: 表示“没有 avatar-private 能力”, 这种情况就是我说的 xxxSystem 发现这个workspace不支持没有这个信息，那么就不注入 xxx-cli了，比如接下来要做的 memorySystem 和 toolSystem。不过目前我可能更倾向于命名成 logSystem 和 scriptSystem。因为目前它们都还没达到 Memory、Tool 这种级别的定义。log和script会更加客观一些，这个我们后续可以讨论讨论。skillSystem不大一样，它还支持目录级别的skills，比如 `<workspace>/skills/*`、`<workspaces>/.codex|.claude|.agents/skills/*` 等等
> 4. 参考同样的思路，我们需要定义一个 env.SKILLS_HOME ，而 SKILLS_HOME 是通过对 AVATAR_HOME+PWD 的进一步展开。

> 1. logSystem 我想表达的是“活动日志”，类似于日记，记录一些碎片化的事务
> 2. scriptSystem 我想表达是脚本管理，类似于 bin 路径的一种思路，bin意味着binary，script意味着ts/js/py这些脚本，用来存放一些脚本文件，但scriptSystem是否有必要存在？我并不确定，也许可以砍掉，或者我们可以讨论讨论
> 3. AVATAR_HOME 固定成`;`，这个我同意，但我更新倾向于，如果是非window系统，那么也支持 OS-PATH-delimiter ，比如说，macos解析的时候，如果遇到`:`，那么也能理解成`;`，而写入的时候，统一使用`;`

> 梳理完善我们的change

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Kernel background: `AttentionSystem` is the kernel, and the only bottom-level primary tool should be WorkspaceSystem bash. | The change must not keep growing hard-coded root/project tool branches as the platform law. |
| 2 | User | Redesign kernel behavior from env, not from hard-coded code paths. | Workspace instance env becomes the capability source of truth. |
| 3 | User | Add `env.AVATAR_HOME="<avatar_root_workspace_path>;[...]"`, with `workspace.getAvatarHome()`, `workspace.setAvatarHome(paths)`, and pure `parseEnvAvatarHome(envValue?)`. | Introduces the first durable capability projection variable and APIs. |
| 4 | User | `AVATAR_HOME` is PATH-like; later entries override earlier entries; entries must be absolute. | Defines ordering and validation law. |
| 5 | User | Empty/missing `AVATAR_HOME` means no avatar-private capability, so systems that need it should not inject their CLI. | CLI availability becomes a capability projection, not a root-workspace special case. |
| 6 | User | `skill-cli` reads current avatarHome and uses multi-skill-source mixing. | `RuntimeSkillRoot` must stop depending on a hard-coded `rootWorkspacePath` avatar layer. |
| 7 | User | Add `env.SKILLS_HOME`, derived from `AVATAR_HOME + PWD`; skillSystem also supports directory-level skills such as `<workspace>/skills/*` and dot-agent skill folders. | Skills need their own derived env law, not just direct `AVATAR_HOME` reading. |
| 8 | User | `xxxSystem` can decide whether its CLI is registered into non-root workspace environments, potentially through workspace lifecycle hooks. | System CLI registration becomes a workspace lifecycle projection. |
| 9 | User | `logSystem` means activity diary / fragmented transaction journal, not memory. | Use `log` as the objective near-term name; do not overclaim "memory" semantics. |
| 10 | User | `scriptSystem` means script management like a script path, but it may not deserve a full System yet. | Keep script capability provisional until lifecycle, execution, router, and provenance justify a System. |
| 11 | User | Canonical write delimiter for `AVATAR_HOME` is `;`; read should also understand OS path delimiter on non-Windows. | Parser/serializer behavior must be explicit and platform-aware. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `openspec/changes/align-avatar-memory-scope-law/*` | The prior change is complete and scoped to Avatar-principal prompt/memory ownership and project hard-code residue cleanup. | This Env-first redesign should be a new change, not extra scope inside the completed cleanup. |
| `openspec/changes/workspace-mounted-systems-and-attention-contexts/*` | A future change already explores mounted workspaces as file-backed system carriers and attention context publishers. | Reuse the lifecycle direction, but replace settings-first/root-token thinking with env-first capability projection. |
| `packages/attention-system/SPEC.md` | AttentionSystem owns durable attention truth and is not the owner of terminal/message/task internals. | This change should route system outputs into attention through adapters, not by making AttentionSystem parse workspace-specific blobs. |
| `packages/app-server/src/workspace-system/types.ts` | `WorkspaceRecord` and `WorkspaceMountRecord` currently have no env or avatarHome; only `WorkspaceExecProfileRecord.env` exists. | The current model cannot express a workspace instance's durable capability env. |
| `packages/app-server/src/workspace-system/store.ts` | `upsertExecProfile` stores process env only on an exec profile. | Process env is not enough: `AVATAR_HOME` must affect workspace capability injection before a one-shot command executes. |
| `packages/app-server/src/runtime-shell-bin.ts` | `buildRootWorkspaceShellEnvironment` injects avatar-private runtime env; public workspace and shared terminal env keep caller env only. | Current capability law is hard-coded by root/public shell class, not env inspection. |
| `packages/app-server/src/session-runtime.ts` | Runtime exposes `root_bash` and `workspace_bash` as separate tool surfaces; root bash receives runtime CLI/env, workspace bash does not. | This is the main remaining root-workspace specialness the new law must collapse or reframe. |
| `packages/app-server/src/workspace-tool-provider.ts` | In-process provider also hard-codes `root_bash` runtime CLI dispatch and `workspace_bash` public execution. | Both in-process and runtime paths need the same WorkspaceSystem capability projection law. |
| `packages/app-server/src/runtime-skills.ts` | `resolveRuntimeSkillRoots` uses `homeDir`, global `~/.agenter/skills`, shared `~/.agents/skills`, and `rootWorkspacePath/skills`; root kinds are static `shared/global/avatar`. | Skill source discovery is still rootWorkspacePath-based and not `AVATAR_HOME/SKILLS_HOME` based. |
| `packages/app-server/src/runtime-skill-contract.ts` | `RuntimeSkillSystemInput` extends `RuntimeSkillLookupInput`, which requires `rootWorkspacePath`. | The skillSystem contract itself still encodes the old law. |
| `packages/app-server/src/skill-browser.ts` | Skill browser groups Avatar skill roots by global workspace plus workspace paths and resolves `resolveWorkspaceAvatarAssetRoot(..., "skills")`. | Studio skill browsing still presents global/workspace grouping, not env-derived skill homes. |
| `openspec/specs/workspace-resource-ownership/spec.md` | Current long-term spec explicitly names root-workspace as a special env/CLI profile. | This change must modify that law if root specialness becomes an env projection instead of a platform category. |
| `openspec/specs/runtime-system-boundary-law/spec.md` | Runtime systems must publish facts/projections/signals/actions through explicit channels and avoid hidden effects. | Workspace lifecycle CLI injection should be modeled as capability projection, not prompt glue or hidden side effects. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not committed yet; artifacts are being authored. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not started; no implementation in this round. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not started. |
| Normal archive | Commit containing `openspec archive <change>` result | Not started. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not needed yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `align-avatar-memory-scope-law` | App-owned prompt/memory truth is Avatar principal scoped; project workspace is cwd/mount/grant/workbench/exec/tool surface. | Reuse as the cleanup baseline. |
| `workspace-mounted-systems-and-attention-contexts` | Mounted workspaces may instantiate systems and publish/mute attention contexts. | Extend, but move the trigger from settings-only declaration toward env capability projection. |
| `workspace-resource-ownership` | Root-workspace is currently a special env/CLI profile; public workspaces and terminals do not inherit root env. | Break/modify: root/private capability should be a named env capability, not a hard-coded workspace class. |
| `runtime-system-boundary-law` | Systems expose WorldFact, CapabilityProjection, SchedulerSignal, AgentAction, and EffectLedger channels. | Reuse: CLI injection is a CapabilityProjection. |
| `app-runtime` delta from previous change | App-owned memory/prompt are principal addressed. | Reuse: `AVATAR_HOME` can point at Avatar principal homes but does not redefine app memory truth. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `从 env 出发` | Environment variables define capability availability and source paths. | Look at the workspace instance env first, then decide what systems/tools exist. |
| `不是在代码上硬编码` | Avoid `rootWorkspacePath` / `projectWorkspace` branches that silently grant capabilities. | No hidden special case just because the workspace is called root or project. |
| `AVATAR_HOME` | Ordered list of avatar-private homes available to a workspace instance. | "This workspace has access to these avatar-private roots." |
| `没有 avatar-private 能力` | Empty/missing `AVATAR_HOME`; systems needing private identity data must not inject commands. | No private tools here. |
| `SKILLS_HOME` | Derived skill search path expanded from `AVATAR_HOME + PWD`. | The concrete list of skill source directories visible to this workspace shell. |
| `logSystem` | Activity log / diary / fragmented transaction journal. | Record events, not distilled memory. |
| `scriptSystem` | Script path/source management, like a higher-level `bin` idea for ts/js/py/sh scripts. | Maybe a capability source first, not necessarily a full System. |
| `后者覆盖前者` | Later env path entries win in resource merge conflicts. | Put broad defaults first, specific overrides later. |
| `project workspace只是工具` | Project workspace is access/cwd/workbench convenience, not identity authority. | Workspace is a surface, not the Avatar owner. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | Current code survey is enough to scope the change. | Not needed yet. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should `parseEnvAvatarHome` throw on a relative/invalid segment, or return only valid absolute paths and let a validator report diagnostics? | The requested signature is `string[]`, but "only absolute" needs an error law. | Prefer strict parser that rejects invalid non-empty segments; empty segments are ignored. |
| Should `SKILLS_HOME` write format also be canonical `;` and read with the same delimiter rules as `AVATAR_HOME`? | The user explicitly said this for `AVATAR_HOME`; `SKILLS_HOME` is PATH-like too. | Yes, same delimiter law for consistency. |
| Should root bash disappear from the model surface in this change, or be kept as a compatibility alias backed by a root workspace instance with `AVATAR_HOME`? | Removing `root_bash` is a larger visible break than changing its implementation law. | Platform law should collapse to WorkspaceSystem bash; compatibility alias can exist only as a projection/alias, not as authority. |
| Should `scriptSystem` become a System now? | The user is explicitly unsure. | No. Define script source/home projection first; promote later only if lifecycle/router/execution/provenance become real. |
| Should `logSystem` replace the older "memory/tool" naming in public routes immediately? | Naming affects Studio IA and API expectations. | Use `logSystem` for activity ledger; avoid claiming memory semantics. Keep router naming as follow-up unless implementation scope reaches Studio. |

## Intent

### Surface Intent

Create a new OpenSpec change that captures the Env-first workspace capability projection architecture: `AVATAR_HOME`, derived `SKILLS_HOME`, workspace lifecycle CLI injection, skill/log/script source law, and the removal of hidden project/root hard-coding.

### Underlying Drive

The previous cleanup removed project workspace as the owner of app-owned assistant memory, but the platform still has a deeper residue: capability is granted by category labels such as root-workspace, public-workspace, root bash, and static runtime skill roots. That makes the code decide "what this workspace is allowed to do" before looking at the workspace instance's declared environment.

The new law moves the authority:

```text
old:
  code branch: root workspace? -> inject private env + root CLI + root skills
  code branch: project workspace? -> no private env, but has workspace overlays

new:
  workspace instance env -> capability projection -> systems register tools/CLIs/sources
```

This keeps project workspace as a tool surface while allowing any workspace instance to advertise or withhold avatar-private capabilities deliberately.

### Final Visible Effect

An operator can inspect a workspace instance and see exactly why a CLI or skill is available:

- `AVATAR_HOME` explains whether avatar-private capabilities are present.
- `SKILLS_HOME` explains which skill directories are searched and in what override order.
- `workspace_bash` runs inside a workspace instance whose env determines available system CLIs.
- A workspace with empty `AVATAR_HOME` will not receive log/script/private CLIs that require avatar-private state.
- A workspace with explicit `AVATAR_HOME` can receive those CLIs without pretending to be the hard-coded root workspace.

## Platform Diagnosis

- Current platform laws:
  - AttentionSystem is durable attention truth owner.
  - WorkspaceSystem owns mounts, grants, workspace assets, bash execution, and current root/public shell split.
  - Root-workspace currently carries avatar-private runtime env/CLI by code branch.
  - SkillSystem currently resolves static `shared/global/avatar` roots, with avatar rooted at `rootWorkspacePath/skills`.
- Does this fit as a regular atom: no. This is not a new CLI command; it changes the law that decides which systems and tools exist in a workspace.
- Does this require law upgrade: yes. The current hard-coded root/public split conflicts with env-first capability projection.
- Breaking update stance: recommended. Compatibility aliases may exist as projections, but must not remain the authority source.
- User confirmations still required:
  - exact invalid-segment behavior for `parseEnvAvatarHome`
  - whether root bash is removed immediately or retained as an alias during migration
  - whether `scriptSystem` is cut, postponed, or scoped as a source projection only

## Reverse-Inferred Design

### Interaction / Visual Story

```text
Workspace instance created
        |
        v
env = {
  PWD: "/repo",
  AVATAR_HOME: "/avatar/base;/avatar/user",
  SKILLS_HOME: derived from AVATAR_HOME + PWD
}
        |
        v
Capability projection
        |
        +-- skillSystem reads SKILLS_HOME -> skill-cli visible
        +-- logSystem sees AVATAR_HOME -> log-cli visible
        +-- script source sees SCRIPT_HOME? -> maybe script-cli visible later
        +-- no AVATAR_HOME -> no avatar-private CLI injection
```

### Interface Shape

Minimum contracts:

- `parseEnvAvatarHome(envValue?: string): string[]`
  - pure, no filesystem writes/reads
  - canonical delimiter on write: `;`
  - read delimiter: `;`, plus OS path delimiter on non-Windows
  - only absolute paths survive validation
  - duplicate normalized paths keep the last occurrence
- `serializeEnvAvatarHome(paths: readonly string[]): string`
  - writes canonical `;`
  - rejects non-absolute paths before serialization
- `workspace.getAvatarHome(): string[]`
  - reads the workspace instance env
  - returns `[]` for empty/missing `AVATAR_HOME`
- `workspace.setAvatarHome(paths: string[]): void`
  - validates absolute paths
  - writes canonical `AVATAR_HOME`
  - updates derived capability projection
- `deriveEnvSkillsHome(input: { avatarHome: readonly string[]; pwd: string }): string[]`
  - expands Avatar homes and current workspace directory into concrete skill source roots
  - is pure and side-effect-free

### Data Shape

Facts that must stay separate:

- Workspace definition: path identity and durable workspace metadata.
- Workspace instance/mount: runtime-specific instance with env/capability projection.
- Exec profile env: process-launch defaults; not the owner of system capability.
- Per-command env overlay: a one-shot shell overlay; not persisted as capability truth.
- Capability projection: derived visible tools/CLIs/sources for a workspace instance.
- `AVATAR_HOME`: avatar-private home list; empty means no avatar-private capability.
- `SKILLS_HOME`: derived skill source list; can still include PWD-local skills even when `AVATAR_HOME` is empty.

### Architecture Shape

Recommended platform law:

1. WorkspaceSystem owns workspace instance env and bash execution.
2. Systems do not ask "am I in root workspace?" They ask "does this workspace instance env provide the capability I require?"
3. System CLI registration is a lifecycle projection:
   - workspace instance created/updated
   - system receives the workspace instance
   - system validates env/capability
   - system contributes CLI/tool bindings only when supported
4. SkillSystem is special because it also supports directory-level skills from PWD and dot-agent folders.
5. LogSystem is an activity ledger system, not memory.
6. ScriptSystem is not promoted until there is a real lifecycle/execution/router law.
7. Root/private specialness, if still exposed, must be a named projection or alias derived from env, not an authority branch.

Forbidden couplings:

- no `if rootWorkspacePath then inject private CLI`
- no `if projectWorkspace then skip global/avatar roots`
- no hard-coded `rootWorkspacePath/skills` as the Avatar skill layer
- no system-specific prompt glue as a substitute for capability projection
- no silent fallback from invalid `AVATAR_HOME` to current cwd

### Architecture Options

| Option | Shape | Judgment |
| ------ | ----- | -------- |
| A. Env-first capability projection | Workspace env is authority; `AVATAR_HOME/SKILLS_HOME` drive CLI/source injection; root bash becomes an alias/projection at most. | Recommended. This matches the user's requested paradigm shift and removes hidden root/project logic. |
| B. Patch current root/public split | Keep root bash as the only private CLI surface and add `AVATAR_HOME` only inside skillSystem. | Rejected as technical debt. It preserves the same hidden authority branch and only changes names. |

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Invalid `AVATAR_HOME` handling | It changes runtime failure behavior for malformed env. | Strict reject non-empty relative entries. |
| Root bash visible compatibility | Removing `root_bash` may break tests, prompts, and operator habits. | Keep only as a compatibility alias backed by a workspace instance, then remove in a later product cleanup. |
| Script system scope | User is unsure whether it should exist. | Do not implement a full scriptSystem in this change. |
| Studio router naming | `logs/scripts` routers affect product IA. | Capture as follow-up unless implementation scope reaches Studio. |

## Intent-Driven Plan

- [ ] 1. Lock the Env-first workspace capability projection law in specs.
- [ ] 2. Add pure env parsing/serialization and derived `SKILLS_HOME` contracts.
- [ ] 3. Move workspace instance capability env out of exec-profile-only storage.
- [ ] 4. Rework skillSystem roots from static `rootWorkspacePath` layers to env-derived multi-source roots.
- [ ] 5. Introduce system CLI projection hooks for workspace lifecycle.
- [ ] 6. Reframe root/private CLI specialness as a capability projection or compatibility alias.
- [ ] 7. Add BDD coverage proving no project/root hard-code is the authority source.
- [ ] 8. Self-review whether `scriptSystem` remains postponed and whether `logSystem` naming is still correct.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should pure parsers throw or expose diagnostics? | The requested return type is `string[]`, but validation UX may need diagnostics. | Parser throws for invalid non-empty segments; caller catches and reports. |
| Should `SKILLS_HOME` include built-in/plugin skill roots? | Built-ins are not filesystem env homes in the same sense. | `SKILLS_HOME` contains writable/discoverable filesystem roots; built-ins remain separate read-only providers. |
| What is the exact dot-agent expansion order? | Later wins, so order is behavior. | `<root>/skills`, `<root>/.codex/skills`, `<root>/.claude/skills`, `<root>/.agents/skills`. |
| Should log files live under every `AVATAR_HOME` or only the final override home? | Activity log write ownership differs from read/merge ownership. | Read can merge all homes; writes go to the last `AVATAR_HOME` entry. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Only rename memory/tool to log/script | Naming alone does not remove root/project hard-coding. |
| Keep `rootWorkspacePath` as skillSystem input and derive `AVATAR_HOME` from it internally | This hides the new law behind the old authority input. |
| Put `AVATAR_HOME` only on command env overlays | CLI injection happens before command execution; overlays are too late and too transient. |
| Auto-inject private CLIs when cwd is under `~/.agenter` | That is another filesystem special case, not env-first capability projection. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2 consecutive review rounds
- Custom exit condition from intent: the implementation may be considered complete only when workspace capability projection, skill source discovery, and CLI injection can be explained from env values rather than root/project workspace labels.

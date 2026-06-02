# Intent Document

## Current Round

- Round: 1
- Status: Investigation complete; research-plan drafted for user discussion before specs/tasks.
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

> 我之前有订一个规范，使用任何未知的命令之前（已知的就是cd/ls/cp/cat 这类的标准，未知的就是我们系统内部自己定义并告知给 AI的），必须先用skills 进行读取和理解。这个有在系统提示词里面体现吗？
> 现在default的系统提示词是怎么样的？分几部分，每部分在说什么？

> 所以接下来，我们的关注点应该挪到这里：整体系统提示词是如何更新的。
>
> 我大脑中的设计是，一切皆文件。
> 你先看一下default的AGENTER.mdx写的是什么内容

> 所以这就是关键的异常，一个Avatar被创建出来后，就不该依赖内存的提示词，而是需要将内存的提示词写入到它的AGENTER.mdx中。
>
> 我记得我们今天刚做了ShellAssistant的提示词，用的是 `global:builtin/..` 这样的路径是不是？但是我却没有看到这些提示词被写入到 ~/.agenter/ 目录内

> 所以整理起来，这里是两个问题：
> 1. 没有遵循一切接文件，也就意味着没有构建起文件依赖和基于依赖图的监听
> 2. 未来如何让系统提示词升级起来更加自然
>
> 等你调查完后，我们进入openspec vision的流程讨论和撰写change

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Unknown internal runtime CLI command families must be understood through SkillSystem before first substantive use. | Prompt updates must preserve this rule and make prompt source drift observable. |
| 2 | User | The focus moved to how the whole system prompt updates. The design premise is "一切皆文件". | Runtime prompt authority must become file-backed and inspectable, not hidden in process memory. |
| 3 | User | An Avatar should not depend on memory prompt after creation; prompt content must be written into the Avatar's `AGENTER.mdx`. | Avatar creation/assistant seeding must materialize prompt truth at the Avatar principal root. |
| 4 | User | ShellAssistant recently used a `global:builtin/...` path, but the expected prompt files were not visible under `~/.agenter/`. | Builtin/app prompt resources need visible materialization or explicit dependency evidence. |
| 5 | User | The two problems are missing file dependency/listener topology and unnatural future prompt upgrades. | The change must solve both durable file authority and upgrade flow, not just seed one missing file. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `/Users/kzf/.agenter/avatars/by-nickname` | Current real state has `default`, `architect`, `jane`, and `relay-bot` aliases; no `shell-assistant` alias exists. | ShellAssistant seed path cannot have run for the expected nickname in this home. |
| `/Users/kzf/.agenter/auth-service/auth-service.sqlite` | `principal_registry` has avatar principals for `default`, `architect`, `jane`, and `relay-bot`; no `shell-assistant` avatar principal. | The current machine has not materialized a ShellAssistant Avatar. |
| `/Users/kzf/.agenter` file scan | No `AGENTER.mdx`, `ShellAssistant.mdx`, or `builtin/` prompt roots were found under current `~/.agenter`. | Real state violates the intended file-backed prompt law. |
| `/Users/kzf/.agenter/daemon.runtime.json` | The active daemon was launched from `.worktree/web-heartbeat-view/packages/cli/src/bin/agenter.ts` at `2026-06-01T11:08:37.499Z`. | The live daemon is not the current main checkout and may be running older prompt laws. |
| `.worktree/web-heartbeat-view/packages/app-server/src/app-kernel.ts:1262` | Old daemon worktree `start()` begins with `this.started = true` and does not call `materializeBuiltinPromptDocs`. | Explains why current `~/.agenter/builtin` is absent despite main checkout having that code. |
| `.worktree/web-heartbeat-view/apps/shell/src/app-runtime/AGENTER.mdx:1` | Old Shell seed contains only `<Slot src="app:shell/ShellAssistant.mdx" />`. | Explains why current daemon cannot seed the newer `global:builtin/$LANG` wrapper. |
| `packages/app-server/src/app-kernel.ts:1246` | Main checkout `AppKernel.start()` calls `materializeBuiltinPromptDocs({ homeDir: this.getHomeDir() })`. | Main code already has part of the expected builtin materialization law. |
| `packages/app-server/src/i18n.ts:188` | `resolveBuiltinPromptRoot` maps builtin prompts to `~/.agenter/builtin/<lang>`. | The intended builtin prompt root is file-backed under global home. |
| `packages/app-server/src/i18n.ts:215` | `materializeBuiltinPromptDocs` writes all prompt docs under the builtin prompt root. | The platform has a materializer, but current runtime process did not execute it. |
| `packages/app-server/src/app-kernel.ts:2574` | `ensureAvatarPromptSeed` reads existing `AGENTER.mdx`; if missing, it writes `input.seedContent`. | App assistant seeding is seed-if-missing and user edits remain truth. |
| `apps/shell/src/app-runtime/bootstrap.ts:177` | Shell bootstrap seeds prompt only when `avatar.nickname === SHELL_DEFAULT_AVATAR`. | Prompt seeding is tied to ShellAssistant nickname, not general Avatar creation. |
| `apps/shell/src/app-runtime/AGENTER.mdx:1` | Main Shell seed wrapper includes `global:builtin/$LANG/AGENTER.mdx` then `app:shell/ShellAssistant.mdx`. | Current intended Shell prompt is a thin composition file, not expanded text. |
| `apps/shell/src/app-runtime/ShellAssistant.mdx:19` | Shell prompt requires durable room replies through MessageSystem. | The package prompt carries important behavior law that must remain upgradable. |
| `packages/app-server/src/prompt-store.ts:229` | `FilePromptStore.load()` only uses file override for `AGENTER`; platform docs default from i18n docs. | Runtime still has a split authority: Avatar `AGENTER` can be file-backed, platform docs are imported defaults unless materialized through `global:builtin` Slot. |
| `packages/app-server/src/prompt-store.ts:388` | `global:` Slots resolve to `globalRootDir`, currently `~/.agenter`. | `global:builtin/$LANG/...` should read materialized files if the daemon has written them. |
| `packages/app-server/src/prompt-store.ts:395` | Slot rendering reads resources recursively but does not expose a dependency graph. | The runtime cannot naturally watch all prompt dependencies yet. |
| `packages/app-runtime/SPEC.md:16` | Existing law says app-owned assistant initialization is seed-if-missing and global principal `AGENTER.mdx` is truth. | The desired law is already partially specified. |
| `packages/app-server/SPEC.md:140` | Existing law says Avatar-authored prompt truth is only global principal `AGENTER.mdx`. | Confirms workspace/nickname/session prompt roots should not be runtime truth. |
| `packages/app-server/SPEC.md:141` | Existing law says daemon startup must overwrite builtin prompt docs under `~/.agenter/builtin/<lang>`. | The current real state is stale relative to the main repo law. |
| `openspec/schemas/vision-driven/schema.yaml:5` | Vision-driven workflow starts from `research-plan` generating `plans/plan.md`. | This artifact is the correct SSOT for this discussion. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not yet; this round drafts the first artifact. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not applicable yet. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not applicable yet. |
| Normal archive | Commit containing `openspec archive <change>` result | Not applicable yet. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not applicable yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/changes/canonicalize-avatar-prompt-global-root` | Canonical prompt truth moved to global principal root. | Reuse and extend; do not reintroduce nickname/workspace prompt truth. |
| `packages/app-runtime/SPEC.md` | App assistant seed is generic `AGENTER.mdx` seed-if-missing; app prompt body should be package resource via `app:` or `npm:` Slot. | Reuse; add dependency-graph and upgrade semantics. |
| `packages/app-server/SPEC.md` | Builtin prompt root must be materialized under `~/.agenter/builtin/<lang>` and inherited by explicit `global:builtin/$LANG` Slot. | Enforce; add startup diagnostics and watcher expectations. |
| `openspec/specs/avatar-prompt-guidance/spec.md` | Shared Avatar prompt law defines behavior guidance as durable prompt contract. | Extend with file authority and freshness requirements. |
| `openspec/changes/introduce-vision-driven-openspec-schema` | Intent Document SSOT drives specs/tasks and review. | Use for this change. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `一切皆文件` | Durable truth should be inspectable, editable, dependency-trackable files. | Runtime prompt state must not be hidden only in memory/imports. |
| `接文件` | Follow file-backed authority, including dependency edges and watchers. | Prompt composition needs a file dependency graph. |
| `Avatar被创建出来后` | Avatar identity creation is the moment prompt truth must be owned by that Avatar. | Creation/ensure should seed missing `AGENTER.mdx`. |
| `内存的提示词` | Prompt text held only by process/package import without visible file ownership. | Hidden prompt source that cannot be watched or edited as user asset. |
| `系统提示词升级起来更加自然` | Prompt package/app upgrades should flow without manual copying, but remain inspectable and controllable. | Use thin file wrappers plus tracked dependencies instead of stale expanded copies. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | Investigation was resolved through existing code and runtime state. | No spike needed before specs. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should Avatar `AGENTER.mdx` contain fully expanded prompt text, or a thin Slot wrapper over file-backed builtin/app resources? | Fully expanded text maximizes local ownership but freezes upgrades; wrapper preserves natural upgrades but requires dependency graph/watch. | Prefer thin wrapper as Avatar-owned truth, with every Slot dependency resolved to a file node and exposed in a prompt dependency graph. |
| Should this change backfill existing Avatars that currently lack `AGENTER.mdx`? | Backfill creates new user-visible files and can affect prompt behavior for existing sessions. | Backfill should be explicit and safe: seed missing files only, never overwrite non-empty user files. |
| Should app package prompt files also be mirrored into `~/.agenter/apps/<app-id>/...`, or is package-file dependency tracking sufficient? | User expected to see prompt files under `~/.agenter`, but package resources are also real files. | Builtins must be mirrored under `~/.agenter`; app resources can stay package-owned if the dependency graph exposes their resolved file path and upgrade identity. |

## Intent

### Surface Intent

Make system prompt updates obey "everything is file": when an Avatar exists, its prompt truth must be a visible `AGENTER.mdx`; builtin prompt docs must be visible under `~/.agenter/builtin/<lang>`; composed prompt Slots must form a concrete file dependency graph that the runtime can watch and use for natural prompt upgrades.

### Underlying Drive

The current system has two competing truths:

1. A durable law in SPEC and current main checkout that says Avatar prompts and builtin prompts are file-backed.
2. A real running daemon and session history where prompt text came from older package/import state and left no complete file graph in `~/.agenter`.

The user's deeper pressure is not "write one missing file". The pressure is to remove hidden prompt authority so future prompt changes are observable, explainable, and refreshable without relying on stale process memory.

### Final Visible Effect

An operator can inspect an Avatar and see:

- `~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`
- `~/.agenter/builtin/<lang>/*.mdx`
- a prompt render/dependency report listing every file or package resource used by the final system prompt
- a freshness status showing whether a running session is using current prompt files or a stale snapshot

When ShellAssistant or builtin prompt guidance upgrades, the Avatar's wrapper remains user-owned while the dependency graph points at updated builtin/app files. The runtime can reload or schedule a prompt refresh from file changes instead of silently depending on the process version that happened to start first.

## Platform Diagnosis

- Current platform laws:
  - Avatar-authored prompt truth is global principal `AGENTER.mdx`.
  - Builtin platform prompt docs should be materialized under `~/.agenter/builtin/<lang>`.
  - App-specific prompt guidance can be referenced through `app:<app-id>/<file>` or `npm:<package>/<file>`.
  - Prompt mixing is done by MDX `<Slot src="..."/>`.
- Does this fit as a regular atom: no.
- Does this require law upgrade: yes. The missing atom is a PromptAuthority / PromptDependencyGraph platform law, not a Shell-specific patch.
- Breaking update stance: prefer breaking cleanup of hidden prompt fallbacks and stale daemon behavior, but do not overwrite user-edited prompt files.
- User confirmations still required: whether to backfill existing Avatars immediately, and whether app prompt resources must also be mirrored under `~/.agenter`.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator opens or inspects an Avatar:

```text
Avatar default
  prompt: ~/.agenter/avatars/by-principal/0x.../AGENTER.mdx
  status: current
  dependencies:
    ~/.agenter/builtin/zh-Hans/AGENTER.mdx
    ~/.agenter/builtin/zh-Hans/AGENTER_SYSTEM.mdx
    app:shell/ShellAssistant.mdx -> apps/shell/src/app-runtime/ShellAssistant.mdx
  last rendered: 2026-06-02 ...
  stale reason: none
```

If a dependency changes, the system marks prompt state dirty, reloads the prompt store at the next safe model boundary, and records the effect source. There is no invisible prompt mutation.

### Interface Shape

- `ensureAvatarPromptSeed` remains seed-if-missing, but its contract should be widened from "Shell calls it if default avatar" to "Avatar creation or app assistant creation declares the seed policy for missing `AGENTER.mdx`".
- A new prompt inspection surface should expose:
  - canonical Avatar prompt path
  - final rendered prompt source identity
  - dependency nodes with URI, resolved file path, mtime/hash, and owner kind
  - stale/current status for a running session
- Prompt rendering should return both text and dependency trace.

### Data Shape

- Durable facts:
  - Avatar principal id
  - canonical `AGENTER.mdx` path
  - builtin prompt materialized file paths
  - render dependency trace records or last-render metadata
- Projections:
  - current/stale prompt status
  - final rendered system prompt text
  - prompt source labels shown in UI/debug output
- Must not confuse:
  - package import default docs with Avatar prompt truth
  - rendered prompt text with source files
  - prompt dependency graph with user memory or NoteSystem facts

### Architecture Shape

Option A, recommended law upgrade:

- Introduce a prompt authority graph:
  - `AvatarPromptAuthority` owns missing-file seeding and canonical prompt identity.
  - `BuiltinPromptMaterializer` owns `~/.agenter/builtin/<lang>` overwrite-on-daemon-start.
  - `PromptResourceResolver` resolves `global:`, `app:`, `npm:`, `file:`, `http:` to dependency nodes.
  - `PromptRenderer` emits `{ text, dependencies }`.
  - `PromptWatchService` watches dependency files and marks sessions dirty at model-boundary-safe points.
- Keep Avatar `AGENTER.mdx` as a thin wrapper when upgrade inheritance is desired.
- Never overwrite user-edited non-empty `AGENTER.mdx`.
- Add explicit diagnostics for "daemon running old code / prompt roots not materialized".

Option B, patch-only compromise:

- Restart current daemon from main checkout.
- Backfill missing `~/.agenter/builtin`.
- Seed `default` and `shell-assistant` `AGENTER.mdx` manually or through current API.
- This fixes today's visible symptom but leaves no dependency graph, no watcher topology, and no systematic stale-prompt explanation.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Backfill existing Avatars without `AGENTER.mdx` | Creates new durable user files and may change future session prompts. | Prepare safe seed-if-missing tasks; do not overwrite. |
| Mirror app resources into `~/.agenter` | Changes package-resource ownership and upgrade path. | Track package file dependencies; mirror only builtins unless user chooses stronger home mirroring. |
| Kill/restart current daemon | Affects running sessions and external dev servers. | Treat as verification/remediation task requiring explicit execution timing. |

## Intent-Driven Plan

- [x] 1. Research current prompt state, daemon source, ShellAssistant seed, builtin materialization, and existing specs.
- [ ] 2. Confirm law direction with user: thin wrapper plus dependency graph versus expanded per-Avatar prompt copy.
- [ ] 3. Write OpenSpec delta specs for prompt authority, prompt dependency graph, and Avatar prompt seeding.
- [ ] 4. Write BDD-first tasks for seed, materialize, trace, watch, stale diagnostics, and safe backfill.
- [ ] 5. Implement only after OpenSpec artifacts are reviewed and committed.
- [ ] 6. Self-review against this intent and decide whether the prompt law needs another loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should `default` Avatar be backfilled with a generic `<Slot src="global:builtin/$LANG/AGENTER.mdx" />` wrapper? | The default Avatar currently lacks `AGENTER.mdx`, but it may be user-sensitive. | Yes, seed-if-missing only. |
| Should ShellAssistant creation always create the `shell-assistant` Avatar if absent? | Current real state has no ShellAssistant principal. | Yes, when Shell app starts with its default avatar. |
| Should current running sessions auto-reload prompt after dependency changes, or only new model rounds? | Reload timing can affect in-flight obligations. | Reload at safe model-boundary only, with stale marker before reload. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Only restart daemon and rerun Shell | Solves stale runtime for today but not file dependency graph or natural upgrades. |
| Copy fully rendered prompt into every Avatar on every startup | Overwrites user ownership and makes app/builtin prompt upgrades unnatural. |
| Let `AGENTER_SYSTEM` / `SYSTEM_TEMPLATE` become per-Avatar user files | Violates existing platform law: Avatar extends behavior through `AGENTER.mdx`; platform docs remain managed assets. |
| Treat NoteSystem or memory as prompt source | Notes are raw facts, not prompt truth. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2 consecutive unresolved review rounds routes back to `research-plan`
- Custom exit condition from intent: a running daemon can prove prompt truth through files and dependency graph; creating or inspecting an Avatar no longer requires trusting hidden process memory.

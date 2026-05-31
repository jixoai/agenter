# Intent Document

## Current Round

- Round: 1
- Status: Research plan ready for specs
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

> noteSystem 有提供skills吗？有走真实的AI验证吗？

> 完善noteSystem这个分支任务（要重视，我不想后续又回来返工，包括配套的skills、studio的nodes路由页面 等等）。
>
> 完成后，在回到我们的主线任务，关于app-shell 中的AGENTS.mdx, 这里就不再是用memory files，而是用noteSystem来提供记录的能力

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Asked whether NoteSystem provides skills and whether it has real AI validation. | Treat missing NoteSystem skill and missing real-AI coverage as first-class gaps, not optional polish. |
| 2 | User | Complete the NoteSystem branch task seriously to avoid later rework, including paired skills and Studio `nodes` route page. | Build the product/system surface, not only storage helpers. Interpret `nodes` as `notes` unless later corrected. |
| 3 | User | After NoteSystem is complete, return to the app-shell `AGENTS.mdx` mainline and replace memory-files guidance with NoteSystem-provided recording ability. | App-shell seed prompt and seed assets must stop presenting memory files as the primary recording mechanism and teach `note` instead. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/app-server/src/note-system/*` | NoteSystem currently provides storage, Markdown/frontmatter, search, and `note` CLI implementation. | Existing atom is useful but incomplete as a product surface. |
| `packages/app-server/src/system-cli-projection.ts` | NoteSystem is projected as `command: "note"` when `AVATAR_HOME` is non-empty. | Capability projection law exists; this change should extend surfaces without hard-coding root/project authority. |
| `packages/app-server/skills/*/SKILL.md` | Existing package-owned skills do not include a NoteSystem skill. | Need a `packages/app-server/skills/note/SKILL.md` owned by NoteSystem. |
| `packages/app-server/skills/runtime/references/shell-surface.md` | Runtime skill mentions `note` as a projected CLI. | Runtime skill can reference NoteSystem, but NoteSystem still needs its own guidance atom. |
| `packages/app-server/test/note-system.test.ts` | Deterministic tests cover projection, write/draft/list/show/search, strict modes, and current-workspace scope. | Keep these BDDs and add missing real-AI validation rather than replacing them. |
| `packages/app-server/test/real-*.ts` and `*semantic*.ts` search | No NoteSystem-specific real AI test was found. | Need a real AI validation route for the NoteSystem skill/CLI behavior. |
| `apps/studio/src/routes/(app)` and `apps/studio/src/lib/features` | Studio has primary workbenches for Skills, Messages, Workspaces, Terminals, Avatars, but no Notes route. | Add a real Studio Notes route instead of burying notes inside Skills or Settings. |
| `apps/studio/src/lib/features/shell/app-shell.svelte` | Sidebar systems list has no Notes item. | Notes must become a primary system destination if it is a product surface. |
| `packages/cli/.agenter/AGENTER.mdx` | Static seed still has a `Memory pack` section listing five markdown files. | This is the exact user complaint path; it must move to NoteSystem language. |
| `apps/shell/src/app-runtime/shell-assistant-seeds.ts` | Runtime seed builds the same memory roles and `Memory pack` prompt. | App-shell mainline requires code and tests, not only static prompt text. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Pending |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Pending |
| Normal archive | Commit containing `openspec archive <change>` result | Pending |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not expected |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/runtime-system-cli-projection/spec.md` | NoteSystem is a basic `AVATAR_HOME` capability projection with `note` CLI and Markdown/frontmatter notes. | Extend with complete product surface, skill ownership, and Studio API. |
| `openspec/specs/runtime-skills-cli-surface/spec.md` | Runtime exposes `note` as a projected runtime CLI behind `root_bash`. | Extend guidance so `note` is discoverable through a NoteSystem skill, not only runtime shell reference. |
| `openspec/specs/skills-workbench/spec.md` | Skills workbench provides package-owned and `SKILLS_HOME` skill browsing patterns. | Reuse browser patterns for NoteSystem skill visibility; do not make Notes a subpage of Skills. |
| `openspec/specs/real-ai-semantic-judge-tests/spec.md` and real-AI specs | Real AI validation exists as a repo-level verification category. | Add NoteSystem validation to that category. |
| `openspec/specs/shell-assistant-avatar/spec.md` | Shell assistant self-evolution and behavior are meant to be evaluated by real AI judge scenarios. | Extend app-shell recording guidance toward NoteSystem. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `noteSystem` | Human-oriented note/journal system, not distilled memory. | A system for recording raw human/action notes. |
| `skills` | Runtime skill guidance atoms available to AI through SkillSystem. | A `SKILL.md` that teaches when/how to use `note`. |
| `真实的AI验证` | A test where an actual model follows guidance and uses runtime CLI, not only deterministic unit tests. | Real-provider validation. |
| `studio的nodes路由页面` | Interpreted as Studio `/notes` route/page for the NoteSystem product surface. | If `nodes` was literal, this route can be renamed before implementation. |
| `app-shell 中的AGENTS.mdx` | Shell assistant seed prompt path: static `packages/cli/.agenter/AGENTER.mdx` plus generated shell seed in `apps/shell`. | The prompt should teach NoteSystem recording instead of memory files. |
| `不想后续又回来返工` | Do the durable product/system surface now, not a narrow CLI patch. | Include API, Studio, skill, tests, and real-AI validation. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none yet | Not needed before specs; existing tests and surfaces provide enough evidence. | n/a |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Did `nodes` literally mean graph nodes, or was it a typo for `notes`? | Route naming and IA differ. | Treat it as `/notes` because the whole request is about NoteSystem. |
| Should old memory-role files be migrated into notes automatically? | Automatic migration can rewrite user assets. | Do not auto-migrate content in this change; stop seeding/teaching memory files and expose NoteSystem as the recording path. |

## Intent

### Surface Intent

Complete NoteSystem so it has the missing surfaces the user immediately noticed: its own skill guidance, real AI verification, Studio Notes route, and app-shell prompt integration. After this, app-shell should no longer instruct the assistant to record into memory files; it should use NoteSystem to record raw notes.

### Underlying Drive

The earlier Env-first change proved capability projection, but NoteSystem remained a thin validation target. That is not enough for the app-shell product line because recording is a core assistant behavior. A memory-file list is a hard-coded residual surface; NoteSystem should become the orthogonal recording atom, with skills and Studio visibility making the behavior inspectable.

### Final Visible Effect

An operator can open Studio `/notes`, inspect avatar-private notes by notebook/section/page, search them, and read page content. An AI can expand the NoteSystem skill, understand when to use `note draft`, `note write`, `note list`, `note show`, and `note search`, and a real-AI validation proves the guidance can be followed. Shell assistant prompts stop naming `user-model.md`, `pairing-playbook.md`, `terminal-habits.md`, `self-evolution-log.md`, and `hosting-objective.md` as the recording mechanism.

## Platform Diagnosis

- Current platform laws: workspace env projects capability; SkillSystem owns guidance atoms; Studio surfaces system workbenches through app-level navigation; real AI tests validate behavior that deterministic tests cannot judge.
- Does this fit as a regular atom: mostly yes. NoteSystem can grow from CLI-only atom to full system surface through existing projection, TRPC, SkillSystem, and Studio patterns.
- Does this require law upgrade: yes, but local and durable: define NoteSystem as a first-class recording surface that owns skill guidance and product inspection. Do not invent a MemorySystem compatibility layer.
- Breaking update stance: break prompt language away from memory files. Preserve existing user files as assets; do not delete or migrate them without explicit future approval.
- User confirmations still required: no blocking confirmation; default `/notes` for the `nodes` typo and no destructive migration.

## Reverse-Inferred Design

### Interaction / Visual Story

The operator sees a Notes item in the Studio system navigation. The route opens a workbench-like surface with notebooks and sections on the left, page list/search in the center, and the selected Markdown/frontmatter page in the detail area. Empty or missing `AVATAR_HOME` is shown as a capability state, not as a broken page.

The AI sees a NoteSystem skill that tells it to capture raw activity into `note draft` when it has useful evidence, use named notebook/section/page only when the category is clear, search/show before overwriting, and never present notes as distilled memory unless a future memory derivation system creates that projection.

The shell assistant prompt says recording is done through NoteSystem CLI. Existing markdown memory files are legacy user assets, not the default recording API.

### Interface Shape

- Kernel API: list note notebooks/sections/pages, show page, search notes, and expose capability metadata for the current avatar/workspace group.
- TRPC router: `note.catalog`, `note.page`, `note.search` read APIs; write can remain CLI-first unless Studio editing is explicitly added in this change's specs.
- Client SDK: thin typed facades over note router outputs.
- Studio route: `/notes` primary app route, wired into app shell sidebar.
- Skill: `packages/app-server/skills/note/SKILL.md` with focused references if needed.
- Real AI test: a provider-gated integration where the model uses `skill info note` and `note draft/search/show` through `root_bash`.

### Data Shape

- Note fact: Markdown file with frontmatter under `<active-avatar-home>/notes/<notebook>/<section>/<page>.md`.
- Note projection: UI/API records derived from files and current workspace/avatar capability env.
- Memory/user model: not the same fact. Any future distilled memory must be created by a separate derivation system.
- Legacy memory files: preserved user assets, but not advertised as the recording path.

### Architecture Shape

- NoteSystem owns note storage and note inspection APIs.
- SkillSystem owns discovery and guidance, but NoteSystem owns the content of its skill atom.
- Studio consumes typed client SDK APIs, not filesystem paths.
- App-shell seed consumes NoteSystem language and no longer hard-codes memory file roles as operational guidance.
- Runtime direct tools remain `workspace_list`, `root_bash`, and `workspace_bash`; NoteSystem remains accessed through projected CLI/API surfaces.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Auto-migrate old memory files into notes | It rewrites user-owned data and may collapse semantic roles too early. | Do not migrate automatically. |
| Literal `/nodes` route | If the user meant graph nodes, `/notes` would be wrong. | Use `/notes` because this is a NoteSystem task. |

## Intent-Driven Plan

- [ ] 1. Research current NoteSystem, SkillSystem, Studio routes, app-shell prompts, and real-AI test patterns.
- [ ] 2. Write specs for NoteSystem product surface, NoteSystem skill guidance, Studio Notes workbench, app-shell prompt migration, and real-AI validation.
- [ ] 3. Write BDD tasks covering kernel/TRPC/client APIs, Studio route, skills, prompt seed changes, and real-AI validation.
- [ ] 4. Implement tasks with separate commits for OpenSpec artifacts, backend/API, skills/prompts, Studio, and verification artifacts.
- [ ] 5. Self-review against intent and only archive after deterministic and real-AI gates are addressed.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should Studio Notes support editing now or read/search only? | Editing requires conflict UI and mode selection; read/search validates product surface with less risk. | Provide read/search/show and capability state first; write stays CLI/skill-driven unless tasks prove editing is required. |
| Should note pages expose raw frontmatter editing? | Raw editing can corrupt metadata without validation. | Render frontmatter as metadata and body as Markdown/text preview; no raw edit in first Studio surface. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Only add a `note` skill and skip Studio | User explicitly asked for Studio route/page and wants to avoid returning later. |
| Only add Studio over raw filesystem | Violates system boundary; Studio should use typed API/client contracts. |
| Keep `Memory pack` and simply mention NoteSystem nearby | Preserves the exact residual design the user wants removed. |
| Auto-convert memory files into notes | Destructive ownership/migration decision without explicit approval. |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: 2
- Custom exit condition from intent: NoteSystem has an owned skill, Studio `/notes` inspection route, typed note read/search APIs, real-AI validation evidence or explicit provider-gated skip, and app-shell prompt seeds no longer instruct recording into memory files.

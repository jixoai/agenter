# Intent Document

## Current Round

- Round: 1
- Status: research-plan locked for NoteSystem package extraction
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

> 不对。note-system应该是一个独立的包。请完成完整地独立化后，再进行我们的主线任务。
> 这个包的结构参考现有成熟的 *-system 的其它包

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | `note-system应该是一个独立的包` | NoteSystem cannot remain under `packages/app-server/src/note-system`; it must become a first-class package atom. |
| 1 | User | `请完成完整地独立化后，再进行我们的主线任务` | App-shell follow-up is blocked until package extraction is complete and verified. |
| 1 | User | `这个包的结构参考现有成熟的 *-system 的其它包` | Package layout should mirror mature packages such as `message-system`, `attention-system`, `session-system`, `task-system`, and `terminal-system`. |
| Prior | User | `note-cli 没有和 skill-cli、message-cli一样的架构设计，否则它的输入一定会是 JSON 的这种数据结构` | The extracted package must preserve JSON-first CLI descriptor behavior; extraction cannot downgrade CLI shape. |
| Prior | User | `noteSystem自身没有提供 tags分组、references引用、rename重命名` | The package must continue to own tags, references, rename, MIME, and SQLite-backed identity. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/app-server/src/note-system/*` | NoteSystem storage, SQLite database, search, surface, CLI, markdown parsing, and types are currently app-server internals. | Confirms the user's correction: the system atom is embedded in a host package. |
| `packages/app-server/test/note-system.test.ts` | BDD tests import `../src/note-system/*` directly. | Tests reinforce the wrong ownership boundary and should move with the package. |
| `packages/app-server/src/system-cli-projection.ts` | App-server imports `projectNoteCliCapabilities` from `./note-system`. | Projection should stay in app-server, but it should consume `@agenter/note-system` as an atom. |
| `packages/app-server/src/runtime-cli.ts` | App-server imports `createNoteCommand` from `./note-system`. | Runtime command wiring is host behavior; command implementation can be provided by the NoteSystem package with env reader injection. |
| `packages/app-server/src/runtime-skills.ts` and `runtime-skill-catalog-builder.ts` | Built-in runtime skills are discovered from `packages/*/skills`. | Moving `skills/note` to `packages/note-system/skills/note` will make package ownership visible in the generated catalog. |
| `packages/message-system/package.json` | Mature system package uses private workspace package, `exports`, package-local tests, and package-owned skills. | Provides the target package shape. |
| `packages/attention-system/package.json` | Mature system package has minimal `exports` and package-local `skills`. | Confirms small system packages do not need app-server ownership. |
| `packages/task-system/package.json` | Mature system package carries own dependencies, tests, and typecheck script when useful. | NoteSystem should own `minisearch`, `zod`, `just-bash`, and package tests. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | pending |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | pending |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | pending |
| Normal archive | Commit containing `openspec archive <change>` result | pending |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | pending |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/note-system-product-surface/spec.md` | NoteSystem owns notebook -> section -> page identity, SQLite index, tags, references, MIME, rename, and read-only SQL. | Extend with package ownership law. |
| `openspec/specs/runtime-system-cli-projection/spec.md` | Runtime systems project CLIs based on env capability; NoteSystem CLI is `AVATAR_HOME` gated and JSON-first. | Reuse; app-server remains projection host, package owns note capability logic and CLI implementation. |
| `openspec/specs/studio-notes-workbench/spec.md` | Studio must consume NoteSystem through typed facades and not import app-server internals. | Extend wording from "not app-server internals" to "not NoteSystem implementation internals". |
| `openspec/specs/client-runtime-store/spec.md` | Client runtime store exposes typed NoteSystem facades. | Reuse; no direct package import required in client. |
| `SPEC.md` and `packages/app-server/SPEC.md` | Durable law currently states NoteSystem identity/query authority but still describes app-server-owned browsing routes. | Update after implementation so package boundary is durable. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `独立的包` | A first-class workspace package under `packages/note-system`, not an app-server folder. | NoteSystem becomes an atom. |
| `完整地独立化` | Move code, tests, skill, package metadata, exports, dependency ownership, and app-server imports across the boundary. | Not just a path rename. |
| `主线任务` | The app-shell AGENTER/ShellAssistant follow-up. | Do not resume prompt work until extraction is done. |
| `成熟的 *-system` | Existing package atoms such as message/attention/session/task/terminal systems. | Use local package conventions. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none | Existing BDD tests already cover the behavior. | Not needed. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Should `@agenter/app-server` re-export NoteSystem public APIs for compatibility? | Re-exporting can hide ownership, but removing it can break downstream imports. | Do not re-export from app-server unless a current package requires it; update internal imports to `@agenter/note-system`. |
| Should generic runtime tool descriptor helpers become a shared package now? | `note` CLI currently uses app-server-local descriptor helpers, which an independent package cannot import. | Keep this change focused: NoteSystem owns a small package-local note descriptor parser/help renderer; app-server generic descriptor extraction can be a future platform cleanup. |

## Intent

### Surface Intent

NoteSystem must be promoted into a standalone package shaped like the existing mature `*-system` packages before app-shell work continues.

### Underlying Drive

The deeper pressure is orthogonality: NoteSystem is a platform atom with storage identity, CLI law, package-owned skill guidance, and query behavior. Keeping it inside `app-server` makes the host package a hidden authority for note facts, which contradicts the system physics we are using for message, attention, terminal, task, and session systems.

### Final Visible Effect

An operator or future agent can inspect the repo and see `packages/note-system` as the owner of NoteSystem code, tests, skill, SPEC, exports, and dependencies. `app-server` only wires that atom into runtime CLI projection, tRPC routes, and host env semantics. The generated built-in skill catalog names `@agenter/note-system` as the owner of the `note` skill.

## Platform Diagnosis

- Current platform laws: mature systems live as package atoms under `packages/*-system`, own their core types/tests/skills/specs, and are consumed by app-server through package imports.
- Does this fit as a regular atom: yes. NoteSystem already has coherent storage/query/CLI behavior and can become a package without changing user-facing note semantics.
- Does this require law upgrade: yes, the package boundary law must be made explicit for NoteSystem so future systems do not get embedded in app-server by inertia.
- Breaking update stance: break internal import paths and package ownership now; preserve user-facing CLI, tRPC, Studio, and note artifact behavior.
- User confirmations still required: none for code extraction; destructive migration of user note files remains out of scope.

## Reverse-Inferred Design

### Interaction / Visual Story

The AI still uses `note` in the same JSON-first way. Studio Notes still shows notebooks, sections, pages, IDs, tags, references, MIME, and SQL results. The visible change is trust: the NoteSystem skill and implementation are no longer app-server-private, and package ownership is obvious from source layout and generated skill metadata.

### Interface Shape

- `@agenter/note-system` exports storage, surface, search, markdown, CLI, and public types from `src/index.ts`.
- `createNoteCommand` accepts an optional host env reader so app-server can inject `parseEnvAvatarHome` / `AVATAR_HOME` law without NoteSystem importing app-server.
- `projectNoteCliCapabilities` remains a package API that takes explicit `avatarHome`.
- App-server imports NoteSystem APIs from `@agenter/note-system`.

### Data Shape

- Durable NoteSystem facts stay the same: SQLite-backed `bookId`, `sectionId`, `pageId`, tags, references, MIME, timestamps, and human-readable note artifacts.
- Package boundary changes must not rewrite user note files or change database filenames.
- Runtime and Studio projections remain projections, not data authority.

### Architecture Shape

- `packages/note-system`: owns NoteSystem atom.
- `packages/app-server`: host adapter; no `src/note-system` implementation folder.
- `packages/client-sdk` and Studio: continue to use typed runtime facades, not package internals.
- Generated runtime skill catalog: package-owned `note` skill comes from `packages/note-system/skills/note/SKILL.md`.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Destructive note artifact migration | Could rewrite user-owned facts. | Do not do it. |
| Broad runtime descriptor package extraction | Larger platform refactor beyond this correction. | Keep note descriptor helpers package-local for now. |

## Intent-Driven Plan

- [x] 1. Research current NoteSystem placement and mature `*-system` package patterns.
- [ ] 2. Write specs that make NoteSystem package ownership explicit.
- [ ] 3. Write BDD tasks for extraction, import boundary, skill ownership, and verification.
- [ ] 4. Commit OpenSpec artifacts before app-code work starts.
- [ ] 5. Move NoteSystem into `packages/note-system` with package-local tests, skill, SPEC, exports, and dependencies.
- [ ] 6. Update app-server imports, dependency graph, runtime CLI env injection, generated skill catalog, and durable specs.
- [ ] 7. Run targeted package/app-server/client verification and self-review.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should app-server keep a compatibility export for NoteSystem? | Compatibility vs ownership clarity. | Remove app-server `export * from "./note-system"` and update first-party imports. |
| Should NoteSystem share app-server's generic runtime descriptor helpers? | Avoids parser duplication but requires a new shared package. | Do not introduce a new shared descriptor package in this change. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep `packages/app-server/src/note-system` and call it complete. | Directly violates the user's correction and mature `*-system` package law. |
| Move only files but leave tests/skills/specs owned by app-server. | Not complete independentization; ownership would still be hidden. |
| Make `@agenter/note-system` import app-server workspace/runtime helpers. | Creates reverse dependency from atom to host, breaking orthogonality. |
| Rewrite existing user note artifacts during extraction. | Extraction is a code/package boundary change, not a data migration. |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: if extraction still leaves `packages/app-server/src/note-system` imports or skill ownership after one review, return to research-plan.
- Custom exit condition from intent: app-shell mainline resumes only after `@agenter/note-system` is package-owned, verified, and committed.

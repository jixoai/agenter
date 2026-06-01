## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` reflects the relevant code survey, existing OpenSpec survey, and user Q&A.
- [x] 1.2 Confirm NoteSystem currently lives under `packages/app-server/src/note-system` and is directly imported by app-server tests/runtime wiring.
- [x] 1.3 Confirm mature `*-system` packages own their package metadata, `src/index.ts`, package-local tests, optional `skills/**/SKILL.md`, and durable `SPEC.md`.
- [x] 1.4 Confirm no destructive user note artifact migration or state reset is required for this extraction.
- [x] 1.5 Confirm the app-shell mainline remains blocked until `@agenter/note-system` is extracted and verified.

## 2. BDD Contract

- [ ] 2.1 Move NoteSystem behavior tests from app-server into package-local BDD tests that import `@agenter/note-system` public exports or local package source.
- [ ] 2.2 Add/adjust BDD coverage proving `createNoteCommand` remains JSON-first and accepts host-injected `AVATAR_HOME` env parsing without importing app-server.
- [ ] 2.3 Add/adjust BDD coverage proving app-server CLI projection imports NoteSystem from `@agenter/note-system` and still gates `note` on `AVATAR_HOME`.
- [ ] 2.4 Add/adjust BDD coverage proving the generated runtime skill catalog owns `note` from `@agenter/note-system`, not `@agenter/app-server`.
- [ ] 2.5 Confirm each task checkbox is updated only by the agent that completed and verified it in the current working context.

## 3. Implementation

- [ ] 3.1 Run `bun run openspec:vision -- commit-check extract-note-system-package --phase apply` before app-code work starts and commit ready OpenSpec artifacts.
- [ ] 3.2 Create `packages/note-system` with package metadata, exports, `SPEC.md`, dependencies, package tests, and package-owned skill source.
- [ ] 3.3 Move NoteSystem source files from `packages/app-server/src/note-system` into `packages/note-system/src` without changing note artifact or SQLite data formats.
- [ ] 3.4 Refactor `createNoteCommand` so NoteSystem does not import app-server `workspace-system` or `runtime-tool-descriptors`; app-server injects its current `AVATAR_HOME` env parser.
- [ ] 3.5 Update app-server runtime CLI, system CLI projection, app kernel/tRPC wiring, real-AI validation, and tests to import public APIs from `@agenter/note-system`.
- [ ] 3.6 Move `packages/app-server/skills/note` to `packages/note-system/skills/note` and rebuild the runtime built-in skill catalog.
- [ ] 3.7 Update workspace/package manifests and durable specs so NoteSystem package ownership is visible and app-server only documents host projection responsibilities.
- [ ] 3.8 Remove the app-server implementation/export surface for `./note-system`, leaving no parallel NoteSystem implementation tree.
- [ ] 3.9 Update only current-context completed task checkboxes and commit them with the matching implementation/BDD evidence.

## 4. Verification

- [ ] 4.1 Run package-local NoteSystem tests.
- [ ] 4.2 Run targeted app-server tests for runtime CLI projection, runtime skills, tRPC note routes, and real-AI NoteSystem gate behavior.
- [ ] 4.3 Run targeted client-sdk/runtime-store NoteSystem tests if public projections changed.
- [ ] 4.4 Run `bun run --filter '@agenter/note-system' test`.
- [ ] 4.5 Run `bun run --filter '@agenter/app-server' test`.
- [ ] 4.6 Run `bun run typecheck`.
- [ ] 4.7 Run `bun run openspec:vision -- validate extract-note-system-package`.
- [ ] 4.8 Run `git diff --check`.
- [ ] 4.9 Run `bun run openspec:vision -- commit-check extract-note-system-package --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md` and every spec delta.
- [ ] 5.2 Generate `review/self-review.html` as structured review evidence.
- [ ] 5.3 Record whether the extraction fully aligns, partially aligns with residual risk, or needs another loop.
- [ ] 5.4 If review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.5 If review is entering a real loop, run `bun run openspec:vision -- review-state extract-note-system-package` to persist iteration/recurrence state.
- [ ] 5.6 If review cannot exit normally, run `bun run openspec:vision -- handoff extract-note-system-package` and commit handoff evidence before returning to user discussion.
- [ ] 5.7 If review exits normally, sync durable specs if needed, then archive the change and commit the archive result.
- [ ] 5.8 Run `bun run openspec:vision -- check extract-note-system-package` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

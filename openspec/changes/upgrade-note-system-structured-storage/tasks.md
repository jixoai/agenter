## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` reflects the relevant code survey, existing OpenSpec survey, and user Q&A.
- [x] 1.2 Confirm NoteSystem currently has a handwritten `just-bash` CLI rather than descriptor-backed JSON runtime CLI.
- [x] 1.3 Confirm NoteSystem currently derives page identity from markdown file paths and lacks stable database IDs for rename/reference safety.
- [x] 1.4 Confirm whether user meant `sectionId` instead of `sessionId` in `{bookId、sessionId、pageId}` before adding a runtime-session-specific identity field.
- [x] 1.5 Do not perform destructive migration or automatic markdown rewrites of existing user note files without explicit user approval.

## 2. BDD Contract

- [x] 2.1 Add BDD coverage for descriptor-backed `note` JSON command parsing, help rendering, and `AVATAR_HOME` projection gating.
- [x] 2.2 Add BDD coverage for SQLite-backed note IDs: write returns `bookId`, `sectionId`, `pageId`, timestamps, MIME, tags, references, and readable note URI.
- [x] 2.3 Add BDD coverage for indexing existing markdown files without rewriting them during index build.
- [x] 2.4 Add BDD coverage for tags: notebook tag listing, section tag listing, and page search/filter by tags.
- [x] 2.5 Add BDD coverage for read-only SQL query: SELECT succeeds over bounded views, mutating SQL is rejected without state changes.
- [x] 2.6 Add BDD coverage for MIME writes: default markdown, JSON validation/compaction, invalid JSON no-op, file-path input for binary-like MIME.
- [x] 2.7 Add BDD coverage for markdown reference normalization: relative/reference-style markdown links resolve to `note:<book>/<section>/<pageName>` and database edges.
- [x] 2.8 Add BDD coverage for invalid references failing before commit and non-markdown explicit references resolving from IDs, note URI, or relative key.
- [x] 2.9 Add BDD coverage for rename: page rename preserves `pageId` and reference edges, conflicts are rejected atomically.
- [x] 2.10 Add BDD coverage for client-sdk/runtime-store facades exposing catalog/page/search/tags/references/query metadata.
- [x] 2.11 Add BDD coverage for Studio Notes workbench structured metadata states, including desktop and iPhone 14 route smoke.
- [x] 2.12 Confirm each task checkbox is updated only by the agent that completed and verified it in the current working context.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check upgrade-note-system-structured-storage --phase apply` before app-code work starts and commit ready OpenSpec artifacts.
- [x] 3.2 Introduce a NoteSystem storage/index layer that owns SQLite schema, migrations, stable IDs, and safe transaction helpers under `packages/app-server/src/note-system`.
- [x] 3.3 Preserve human-inspectable file artifacts while moving identity authority to SQLite; add concise intent comments at the file/database boundary.
- [x] 3.4 Implement note write/read/list/search on top of the storage/index layer while preserving `AVATAR_HOME` readable/writable root semantics.
- [x] 3.5 Implement tags as first-class records plus page-tag edges and scoped tag query helpers.
- [x] 3.6 Implement MIME-aware writes for markdown and JSON, and safe source-file writes for binary-like MIME if scoped by tests.
- [x] 3.7 Implement reference parsing and normalization for markdown, explicit reference validation for non-markdown content, and database reference edges.
- [x] 3.8 Implement rename for notebooks/sections/pages with atomic conflict handling and stable reference preservation.
- [x] 3.9 Add read-only SQL query support over bounded note views and reject mutating SQL.
- [x] 3.10 Move `note` to descriptor-backed JSON runtime CLI law and update runtime shell command projection without breaking `AVATAR_HOME` gating.
- [x] 3.11 Update the package-owned `note` skill to teach JSON command shape, tags, references, rename, MIME, SQL query, and `shell-assistant-book` guidance.
- [x] 3.12 Extend tRPC router, app-server exports, client-sdk types, and runtime-store facades for structured note metadata.
- [x] 3.13 Extend Studio Notes route/components to show stable IDs, MIME, tags, references, SQL query results, and rename-safe projections.
- [x] 3.14 Update durable specs (`SPEC.md` and package/client/app specs) after implementation if behavior becomes long-term law.
- [x] 3.15 Update only current-context completed task checkboxes and commit them with matching implementation/BDD evidence.

## 4. Verification

- [x] 4.1 Run targeted NoteSystem storage/CLI/router/client tests.
- [x] 4.2 Run targeted Studio Notes tests and desktop/mobile route smoke for `/notes`.
- [x] 4.3 Run `bun run typecheck`.
- [x] 4.4 Run `bun run --filter 'agenter-app-studio' build` if Studio code changes.
- [x] 4.5 Run `bun run openspec:vision -- validate upgrade-note-system-structured-storage`.
- [x] 4.6 Run `git diff --check`.
- [x] 4.7 Run `bun run openspec:vision -- commit-check upgrade-note-system-structured-storage --phase self-review` before writing final review evidence.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` and `review/self-review.html` comparing implementation against `plans/plan.md` and every spec delta.
- [x] 5.2 Record whether the implementation fully aligns, partially aligns with residual risk, or needs another loop.
- [x] 5.3 If review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If review is entering a real loop, run `bun run openspec:vision -- review-state upgrade-note-system-structured-storage` to persist iteration/recurrence state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff upgrade-note-system-structured-storage` and commit handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, sync durable specs, then archive the change and commit the archive result.
- [ ] 5.7 Run `bun run openspec:vision -- check upgrade-note-system-structured-storage` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

## 6. Deferred App-Shell Follow-Up

- [x] 6.1 After NoteSystem is complete, return to app-shell and replace `shell-assistant-seeds.ts` prompt text with package-owned `ShellAssistant.mdx`.
- [x] 6.2 Add `npm:` package resource protocol with `package.json` `exports` first, package-relative fallback second.
- [x] 6.3 Add `app:` resource protocol as descriptor-backed alias over `npm:`.
- [x] 6.4 Seed `AGENTER.mdx` as a thin Slot wrapper and inject avatar/display variables through `<Slot name="..." />` rather than TS string interpolation.
- [x] 6.5 Update ShellAssistant guidance to use `shell-assistant-book` and the final NoteSystem section/tag/reference model.
- [x] 6.6 Use `$skill-creator` to update `skills/create-agenter-app` after app-shell upgrade is complete.

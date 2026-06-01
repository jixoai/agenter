# Self Review

## Verdict

Status: aligned for the NoteSystem foundation loop and app-shell follow-up loop.

The implementation satisfies the NoteSystem portion of the intent document and the dependent app-shell prompt/resource follow-up. Archive/check tasks remain open because this change has not been archived yet.

## Scope Reviewed

- `plans/plan.md`
- `specs/note-system-product-surface/spec.md`
- `specs/runtime-system-cli-projection/spec.md`
- `specs/client-runtime-store/spec.md`
- `specs/studio-notes-workbench/spec.md`
- implementation under `packages/app-server/src/note-system`
- app-server tRPC/kernel integration
- client-sdk runtime-store integration
- Studio `/notes` route and Playwright smoke
- durable `SPEC.md` updates
- app-shell prompt seed and package-owned `ShellAssistant.mdx`
- ResourceLoader `npm:` / `app:` package resource protocols
- create-agenter-app skill guidance and scaffold output

## Alignment Notes

- SQLite-backed identity is now the authority for books, sections, pages, tags, page-tag edges, and references; file artifacts remain readable.
- Existing markdown files are indexed without automatic rewrite. Rewrites only occur through explicit write/rename paths.
- `note` is JSON-first and descriptor-backed for AI-facing help, while legacy flags remain as compatibility.
- Tags, read-only SQL, MIME-aware writes, markdown reference normalization, explicit non-markdown references, and rename-safe IDs are covered by BDD tests.
- The tRPC and client-sdk write surfaces accept structured reference objects, so JSON/non-markdown references can use stable IDs as requested.
- Studio `/notes` shows structured IDs, MIME, tags, references, read-only SQL, and is covered by desktop and iPhone 14 Playwright route smoke.
- The package-owned `note` skill now teaches `shell-assistant-book`, adaptive sections, JSON command shape, references, tags, rename, MIME, and SQL.
- `apps/shell/src/app-runtime/AGENTER.mdx` is now only `<Slot src="app:shell/ShellAssistant.mdx" />`, preserving user-owned Avatar prompt truth while letting the Shell package update its own assistant guidance.
- `ShellAssistant.mdx` uses `<Slot name="AVATAR_NAME" />` instead of TS string interpolation, so inherited prompts can render Bob, Max, Jane, or other Avatar names correctly.
- ShellAssistant guidance now names notebook `shell-assistant-book`, recommends adaptive sections, and teaches JSON-first NoteSystem usage instead of legacy memory files.
- Resource loading supports `npm:<package>/<file>` with package `exports` first and package-relative fallback second; `app:<app-id>/<file>` maps through app package metadata.
- Nested prompt Slots now inherit parent slot variables, so app package prompts can use the same variable injection as the outer `AGENTER.mdx`.
- `skills/create-agenter-app` now teaches app/package resource exports and scaffolds `./package.json` export metadata for app packages.

## Verification

- `bun test packages/app-server/test/note-system.test.ts`
- `bun test packages/app-server/test/trpc-router.test.ts -t NoteSystem`
- `bun test packages/client-sdk/test/runtime-store.test.ts -t NoteSystem`
- `bun test packages/app-server/test/runtime-skills.test.ts -t NoteSystem`
- `bun test packages/app-server/test/runtime-skill-guidance.test.ts`
- `bun run --filter 'agenter-app-studio' test:unit -- src/lib/features/notes/notes-state.spec.ts src/lib/features/notes/notes-route-contract.spec.ts`
- `bun run e2e -- tests/e2e/notes-workbench.e2e.ts` from `apps/studio`
- `bun run typecheck`
- `bun run openspec:vision -- validate upgrade-note-system-structured-storage`
- `git diff --check`
- `bun run openspec:vision -- commit-check upgrade-note-system-structured-storage --phase apply`
- `bun run openspec:vision -- commit-check upgrade-note-system-structured-storage --phase self-review`
- `bun test packages/settings/test/load-settings.test.ts`
- `bun test packages/app-server/test/prompt-store.test.ts`
- `bun run --filter 'agenter-app-shell' test`
- `bun test skills/create-agenter-app/test/create-agenter-app.test.ts`
- `bun run typecheck`

## Residual Risk

- `sessionId` in the user's example is treated as `sectionId` because the product hierarchy is notebook -> section -> page; no runtime session identity field was added.
- SQL currently exposes read-only bounded views and rejects mutating statements with conservative string checks. If richer SQL is needed later, the next law should remain read-only and add a stronger parser/authorizer rather than opening mutation.
- Rich binary preview/upload UX is not implemented. This batch implements MIME metadata and safe `sourcePath` writes only.
- The Studio Playwright config had stale package paths and pnpm commands; this batch fixes the entry so route smoke can actually run.
- `app:` currently resolves app package identity from workspace package metadata first and then the conventional `agenter-app-<appId>` package name. If future apps use non-conventional installed names without workspace metadata, app descriptor discovery should become the authority.

## Next Step

Run final diff checks, commit the app-shell/resource follow-up batch, then run the OpenSpec `check` gate and decide whether to archive.

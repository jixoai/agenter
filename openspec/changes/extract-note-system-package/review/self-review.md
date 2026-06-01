# Self Review: extract-note-system-package

## Verdict

Partial alignment with residual full-suite risk.

The NoteSystem extraction itself aligns with the locked plan and spec deltas: NoteSystem is now package-owned by `@agenter/note-system`; app-server consumes it as a host/projection atom; the `note` runtime skill is package-owned; and the app-server `./note-system` implementation tree is removed.

The residual risk is not in the NoteSystem path. The final `bun run --filter '@agenter/app-server' test` attempt reached `test/workspace-system.test.ts` and failed on post-test async terminal lifecycle work using a closed message DB. Targeted NoteSystem, app-kernel, typecheck, OpenSpec validation, and diff checks passed.

## Spec Delta Review

- `note-system-product-surface`: aligned. Source, storage, SQLite identity/indexing, Markdown/reference normalization, search, typed surface helpers, CLI, package tests, package skill, and package spec are under `packages/note-system`.
- `runtime-builtin-skill-catalog`: aligned. The generated catalog points `note` to `packages/note-system/skills/note/SKILL.md` and package name `@agenter/note-system`.
- `runtime-system-cli-projection`: aligned. App-server still owns env/capability projection and imports `projectNoteCliCapabilities` / `createNoteCommand` from `@agenter/note-system`.
- Durable specs: aligned. Root, app-server, client-sdk, Studio Notes, and runtime specs document package ownership and projection boundaries.

## Implementation Review

- Platform law: NoteSystem is a standalone package atom.
- Host adapter: app-server injects `AVATAR_HOME` parsing into `createNoteCommand` and keeps runtime/tRPC/Studio projection responsibility.
- Package ownership: dependencies, tests, `SPEC.md`, and `skills/note/SKILL.md` moved with the package.
- Compatibility: note artifact paths, SQLite filename, frontmatter, stable IDs, tags, references, MIME, rename, search, and SQL behavior are preserved.

## Verification Evidence

- Pass: `bun run --filter '@agenter/note-system' test`
- Pass: `bun run --filter '@agenter/note-system' typecheck`
- Pass: targeted app-server NoteSystem/projection/runtime skill tests
- Pass: `bun test packages/client-sdk/test/runtime-store.test.ts --test-name-pattern NoteSystem`
- Pass: `bun test packages/app-server/test/app-kernel.test.ts`
- Pass: `bun run --filter '@agenter/app-server' typecheck`
- Pass: `bun run typecheck`
- Pass: `bun run openspec:vision -- validate extract-note-system-package`
- Pass: `git diff --check`
- Residual: `bun run --filter '@agenter/app-server' test` failed after NoteSystem paths passed, at `test/workspace-system.test.ts`, with unhandled post-test async terminal lifecycle errors against a closed message DB.

## Radar

- Archive should wait until the workspace-system teardown race is either fixed or explicitly accepted as an unrelated suite flake.
- The app-shell mainline can resume after human acceptance of this residual risk, but this self-review does not claim the full app-server suite is green.

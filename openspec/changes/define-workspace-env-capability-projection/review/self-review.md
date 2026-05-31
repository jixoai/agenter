# Vision-Driven Self Review

Generated: 2026-05-31 19:06:40 +0800

## Review State

- Change: `define-workspace-env-capability-projection`
- Iteration: 1
- Recurring issue counts: none
- Exit-condition judgment: normal exit is allowed after `check` passes; implementation, durable specs, and verification now align with the intent.
- Next loop action: run the final OpenSpec check, then archive and commit if it remains clean.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| Capability starts from workspace instance env instead of root/project labels. | `AVATAR_HOME` parser/accessors, `SKILLS_HOME` derivation, `SystemCliProjection`, and durable specs now treat workspace env as the authority. | Pass |
| `AVATAR_HOME` is ordered, absolute, canonical `;`, strict on invalid relative paths, and empty means no avatar-private capability. | `workspace-env-capability.test.ts`, `workspace-env-capability-projection` spec, and `workspace-system/env-home.ts`. | Pass |
| SkillSystem reads explicit skill source order instead of hidden `rootWorkspacePath/skills` authority. | Runtime skill tests, Skill Browser `skills-home` route, and migration note in `docs/migrations/workspace-env-capability-projection.md`. | Pass |
| Existing user skills are not silently lost. | Legacy `<rootWorkspacePath>/skills` is preserved through avatar-root `AVATAR_HOME -> SKILLS_HOME` or explicit documented migration; compatibility fallback remains only when `SKILLS_HOME` is absent. | Pass |
| NoteSystem validates the simple avatar-private projection path. | `note-system.test.ts` covers projection withholding, write/draft/list/show/search, strict modes, and no external service search. | Pass |
| Existing `root_bash` visible naming is not renamed or removed. | Runtime CLI/tool-provider tests, descriptor contract, and specs explicitly keep bash surface naming out of this first apply. | Pass |
| Studio Skill Browser reports backend truth instead of global/project grouping heuristics. | Studio route defaults to `skills-home`; catalog rows show `sourceEnv` and `sourcePath`; targeted Studio/unit tests pass. | Pass |

## Deviations From Intent

1. No functional deviation remains.
2. During verification, running `workspace-system.test.ts` in parallel with real shell integration tests caused SQLite/temp-directory I/O cascade failures. The same workspace shell tests passed when rerun serially. This is a test execution isolation fact, not an implementation-law deviation.
3. The review found and fixed an adjacent canonical-path bug: ordinary workspace avatar-private roots fell back to `by-nickname` when no alias existed. The resolver now uses alias only when present and otherwise falls back to canonical `by-principal`, matching existing durable law.

## New Questions For User

1. No blocker requires user confirmation before archive.
2. Future scope remains explicit: whether `workspace_bash` should expose private projected CLIs for non-root workspaces with non-empty `AVATAR_HOME` needs a separate product/runtime shell-surface change, not this archive.

## Evidence

- HTML report: `review/self-review.html`
- Git commits reviewed: `5b57b9c9`, `12036d93`, `ea4f9826`, `524f1be6`, `8e18cb13`
- Uncommitted paths: implementation and review changes in `packages/app-server`, `packages/client-sdk`, `apps/studio`, durable `SPEC.md` / `openspec/specs`, `docs/migrations`, and this review artifact.
- Task checkboxes updated by this working context: `4.5`, `4.6`, `5.2`, `5.3`, `6.1`-`6.4`, `7.1`-`7.8`; final `7.9` and `8.x` remain for the post-review check/archive loop.

## Verification Commands

- `bun test packages/app-server/test/workspace-env-capability.test.ts packages/app-server/test/runtime-cli.test.ts packages/app-server/test/skill-browser.test.ts packages/app-server/test/system-cli-projection.test.ts`
- `bun test packages/app-server/test/runtime-skills.test.ts packages/app-server/test/runtime-skill-system.test.ts packages/app-server/test/runtime-skill-atoms.test.ts packages/app-server/test/runtime-skill-guidance.test.ts packages/app-server/test/runtime-skill-kernel-adapter.test.ts packages/app-server/test/runtime-skill-catalog-builder.test.ts packages/app-server/test/skill-browser.test.ts`
- `bun test packages/app-server/test/note-system.test.ts`
- `bun test packages/app-server/test/runtime-cli.test.ts packages/app-server/test/workspace-tool-request-body.integration.test.ts packages/app-server/test/system-cli-projection.test.ts`
- `bun test packages/app-server/test/workspace-system.test.ts`
- `bun test packages/app-server/test/real-shell-profile.integration.test.ts packages/app-server/test/real-public-workspace-shell.integration.test.ts` (2 skipped by provider gate)
- `bun test packages/client-sdk/test/runtime-store.test.ts`
- `bun test apps/studio/src/lib/features/skills/skill-browser-state.spec.ts apps/studio/src/lib/features/skills/skills-workbench-location.spec.ts`
- `bun run --filter '@agenter/app-server' typecheck`
- `bun run --filter 'agenter-app-studio' typecheck`
- `bun run typecheck`
- `bun run openspec:vision -- validate define-workspace-env-capability-projection`
- `openspec validate --specs --strict`
- `git diff --check`

## Exit Handling

The review exits normally if the final `bun run openspec:vision -- check define-workspace-env-capability-projection` passes after this artifact exists. Then archive the change and commit the archive result.

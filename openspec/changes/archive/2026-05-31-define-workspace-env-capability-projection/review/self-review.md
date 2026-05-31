# Vision-Driven Self Review

Generated: 2026-05-31 19:13:39 +0800

## Review State

- Change: `define-workspace-env-capability-projection`
- Iteration: 1
- Recurring issue counts: none
- Exit-condition judgment: normal exit. Implementation, durable specs, verification, and archive artifacts align with the accepted Env-first intent.
- Final action: commit the archive move result.

## Intent Alignment

| Intent point | Evidence | Verdict |
| ------------ | -------- | ------- |
| Capability starts from workspace instance env instead of root/project labels. | `AVATAR_HOME` parser/accessors, `SKILLS_HOME` derivation, `SystemCliProjection`, and durable specs now treat workspace env as the authority. | Pass |
| `AVATAR_HOME` is ordered, absolute, canonical `;`, strict on invalid relative paths, and empty means no avatar-private capability. | `workspace-env-capability.test.ts`, `workspace-env-capability-projection` spec, and `workspace-system/env-home.ts`. | Pass |
| SkillSystem reads explicit skill source order instead of hidden `rootWorkspacePath/skills` authority. | Runtime skill tests, Skill Browser `skills-home` route, and migration note in `docs/migrations/workspace-env-capability-projection.md`. | Pass |
| Existing user skills are not silently lost. | Legacy `<rootWorkspacePath>/skills` is preserved through avatar-root `AVATAR_HOME -> SKILLS_HOME` or explicit documented migration; compatibility fallback remains only when `SKILLS_HOME` is absent. | Pass |
| NoteSystem validates the simple avatar-private projection path. | `note-system.test.ts` covers projection withholding, write/draft/list/show/search, strict modes, and no external service search. | Pass |
| Existing `root_bash` visible naming is not renamed or removed. | Runtime CLI/tool-provider tests, workspace shell tests, descriptor contract, and specs explicitly keep bash surface naming out of this first apply. | Pass |
| Studio Skill Browser reports backend truth instead of global/project grouping heuristics. | Studio route defaults to `skills-home`; catalog rows show `sourceEnv` and `sourcePath`; targeted Studio/unit tests pass. | Pass |

## Deviations From Intent

1. No functional deviation remains.
2. Future scope remains explicit: whether `workspace_bash` should expose private projected CLIs for non-root workspaces with non-empty `AVATAR_HOME` needs a separate product/runtime shell-surface change, not this archive.

## Evidence

- HTML report: `review/self-review.html`
- Implementation commit reviewed: `ffe127ff feat: project workspace env cli sources`
- OpenSpec archive path: `openspec/changes/archive/2026-05-31-define-workspace-env-capability-projection`
- Task checkboxes completed through archive readiness: `4.6`, `6.1`-`6.4`, `7.1`-`7.9`, and self-review/archive loop.

## Verification Commands

- `bun test packages/app-server/test/workspace-env-capability.test.ts packages/app-server/test/system-cli-projection.test.ts packages/app-server/test/runtime-skill-atoms.test.ts packages/app-server/test/runtime-skill-system.test.ts packages/app-server/test/runtime-skills.test.ts packages/app-server/test/skill-browser.test.ts packages/app-server/test/note-system.test.ts packages/app-server/test/runtime-cli.test.ts packages/app-server/test/runtime-skill-guidance.test.ts packages/app-server/test/workspace-tool-request-body.integration.test.ts`
- `bun test packages/app-server/test/workspace-system.test.ts --test-name-pattern 'root_bash stays|workspace_bash is a public-workspace shell|workspace_bash exposes helpcenter|nested builtin skill mounts|shared terminal is created|configured terminal is recovered|shared terminal starts inside the avatar root cwd'`
- `bun test packages/client-sdk/test/runtime-store.test.ts --test-name-pattern 'skill browser payloads'`
- `bun run --filter 'agenter-app-studio' test:unit -- skill-browser-state.spec.ts skills-workbench-location.spec.ts`
- `bun test packages/app-server/test/runtime-skills.test.ts --test-name-pattern 'legacy fallback roots|SKILLS_HOME|runtime skill mount roots'`
- `bun run --filter '@agenter/app-server' typecheck`
- `bun run --filter 'agenter-app-studio' typecheck`
- `bun run typecheck`
- `bun run openspec:vision -- validate define-workspace-env-capability-projection`
- `bun run openspec:vision -- check define-workspace-env-capability-projection`
- `bun run openspec -- validate --specs --strict`
- `git diff --check`

## Exit Handling

The final `openspec:vision check` passed before archive. After archive, the active change is intentionally gone and the remaining work is only the archive-move commit.

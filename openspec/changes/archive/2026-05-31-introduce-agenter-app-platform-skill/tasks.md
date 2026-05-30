## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` reflects the relevant code survey, existing OpenSpec survey, and user Q&A about app vocabulary, reverse peer dependency compatibility, and Bun-backed skill scripts.
- [x] 1.2 Confirm current repo evidence for launcher roots, descriptors, release scripts, active package names, and absence of a root `skills/` directory.
- [x] 1.3 Confirm with the user whether public package names move from `agenter-ext-*` to `agenter-app-*` in this change, or whether only source/layout/spec vocabulary changes now.
- [x] 1.4 Confirm with the user whether internal `app-*` package/type names move to app vocabulary in this change or become a follow-up migration.
- [x] 1.5 Keep task checkboxes honest: only check off work completed and verified in the current working context.

## 2. BDD Contract

- [x] 2.1 Add launcher BDD for `apps/*` workspace roots winning before installed and remote sources.
- [x] 2.2 Add launcher BDD for `apps/*` no longer being the active first-party workspace root after the app layout migration.
- [x] 2.3 Add resolver BDD for choosing the highest app package version whose `peerDependencies.agenter` satisfies the current host version.
- [x] 2.4 Add resolver BDD proving old host versions can still match old compatible app lines while ignoring incompatible newer app lines.
- [x] 2.5 Add resolver BDD proving catalog/keyword discovery supplies candidates but does not override `peerDependencies.agenter` compatibility truth.
- [x] 2.6 Add descriptor/runtime BDD proving app descriptor parsing stays data-only and core packages do not import Shell, Studio, or community app implementations.
- [x] 2.7 Add release-script BDD covering renamed app bundle roots, package names, publish order, and remote fallback package arguments.
- [x] 2.8 Add skill BDD or script-level tests for `skills/create-agenter-app/scripts` scaffold and validate flows in both repo mode and external mode.
- [x] 2.9 Add residual-term audit test or script for active source/spec/package surfaces so stale `extensions/*` and extension vocabulary cannot silently return.

## 3. OpenSpec / Git Evidence Gate

- [x] 3.1 Run `bun run openspec:vision -- validate introduce-agenter-app-platform-skill` after specs/tasks edits.
- [x] 3.2 Run `bun run openspec:vision -- commit-check introduce-agenter-app-platform-skill --phase research-plan` before app-code work starts.
- [x] 3.3 Commit the OpenSpec artifacts before implementation begins.

## 4. Implementation

- [x] 4.1 Rename active local app source root from `extensions/*` to `apps/*`, preserving Shell, Studio, and Shell-old boundaries according to the confirmed migration scope.
- [x] 4.2 Update workspace discovery in `package.json`, `pnpm-workspace.yaml`, lockfile, and launcher workspace root resolution to use `apps/*`.
- [x] 4.3 Update first-party app descriptors, CLI tests, app/app runtime tests, package specs, and root specs from extension terminology to app terminology according to the confirmed naming scope.
- [x] 4.4 Implement app package compatibility resolution from `peerDependencies.agenter`, including a testable resolver seam for catalog or remote package metadata.
- [x] 4.5 Update remote fallback command construction so an explicitly selected compatible package version is passed to the Bun runner.
- [x] 4.6 Update release bundle build/publish scripts and tests for app package roots and bundle package directories.
- [x] 4.7 Create `skills/create-agenter-app/SKILL.md` with concise progressive-disclosure workflow, reverse peer dependency compatibility guidance, and script usage.
- [x] 4.8 Create Bun-based `skills/create-agenter-app/scripts` scaffold and validate scripts using `#!/usr/bin/env bun`.
- [x] 4.9 Ensure skill scripts support repo mode under `apps/*` and external mode with explicit target directories.
- [x] 4.10 Add concise intent comments only at critical resolver/scaffold effect points where the reverse compatibility or repo/external mode boundary would otherwise be easy to misread.
- [x] 4.11 Update only current-context completed task checkboxes and commit them with matching implementation and BDD evidence.

## 5. Verification

- [x] 5.1 Run targeted launcher tests, including `packages/cli/test/app-command-launcher.test.ts`.
- [x] 5.2 Run targeted app-runtime/descriptor tests, including `packages/app-runtime/test/app-runtime.test.ts` or its renamed successor.
- [x] 5.3 Run targeted release script tests, including `scripts/release/release-bundles.test.ts`.
- [x] 5.4 Run skill scaffold/validate tests or direct script smoke tests in repo mode and external temp-directory mode.
- [x] 5.5 Run residual active-surface audit for `extensions/`, `agenter-ext`, and `app-extension` terms and classify any remaining matches as archived history, explicit legacy compatibility, or bugs.
- [x] 5.6 Run `bun run openspec:vision -- validate introduce-agenter-app-platform-skill`.
- [x] 5.7 Run `bun run openspec:vision -- commit-check introduce-agenter-app-platform-skill --phase self-review` before writing final review evidence.

## 6. Self-Review Loop

- [x] 6.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, BDD evidence, and residual-term audit.
- [x] 6.2 Generate `review/self-review.html` as structured evidence presentation if this change reaches user-facing or release workflow proof that benefits from HTML review.
- [x] 6.3 If review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [x] 6.4 If the review enters a real loop, run `bun run openspec:vision -- review-state introduce-agenter-app-platform-skill` to persist iteration and recurrence state. N/A: no review loop was required.
- [x] 6.5 If review cannot exit normally, run `bun run openspec:vision -- handoff introduce-agenter-app-platform-skill` and commit the handoff evidence before returning to user discussion. N/A: review exited normally.
- [x] 6.6 If review exits normally, sync durable specs, archive the change, and commit the archive result.
- [x] 6.7 Run `bun run openspec:vision -- check introduce-agenter-app-platform-skill` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

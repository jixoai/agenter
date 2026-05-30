## 1. Alignment / Investigation

- [x] 1.1 Confirm `plans/plan.md` reflects the relevant code survey, existing OpenSpec survey, and user Q&A about app vocabulary, reverse peer dependency compatibility, and Bun-backed skill scripts.
- [x] 1.2 Confirm current repo evidence for launcher roots, descriptors, release scripts, active package names, and absence of a root `skills/` directory.
- [ ] 1.3 Confirm with the user whether public package names move from `agenter-ext-*` to `agenter-app-*` in this change, or whether only source/layout/spec vocabulary changes now.
- [ ] 1.4 Confirm with the user whether internal `product-*` package/type names move to app vocabulary in this change or become a follow-up migration.
- [ ] 1.5 Keep task checkboxes honest: only check off work completed and verified in the current working context.

## 2. BDD Contract

- [ ] 2.1 Add launcher BDD for `apps/*` workspace roots winning before installed and remote sources.
- [ ] 2.2 Add launcher BDD for `extensions/*` no longer being the active first-party workspace root after the app layout migration.
- [ ] 2.3 Add resolver BDD for choosing the highest app package version whose `peerDependencies.agenter` satisfies the current host version.
- [ ] 2.4 Add resolver BDD proving old host versions can still match old compatible app lines while ignoring incompatible newer app lines.
- [ ] 2.5 Add resolver BDD proving catalog/keyword discovery supplies candidates but does not override `peerDependencies.agenter` compatibility truth.
- [ ] 2.6 Add descriptor/runtime BDD proving app descriptor parsing stays data-only and core packages do not import Shell, Studio, or community app implementations.
- [ ] 2.7 Add release-script BDD covering renamed app bundle roots, package names, publish order, and remote fallback package arguments.
- [ ] 2.8 Add skill BDD or script-level tests for `skills/create-agenter-app/scripts` scaffold and validate flows in both repo mode and external mode.
- [ ] 2.9 Add residual-term audit test or script for active source/spec/package surfaces so stale `extensions/*` and extension vocabulary cannot silently return.

## 3. OpenSpec / Git Evidence Gate

- [ ] 3.1 Run `bun run openspec:vision -- validate introduce-agenter-app-platform-skill` after specs/tasks edits.
- [ ] 3.2 Run `bun run openspec:vision -- commit-check introduce-agenter-app-platform-skill --phase research-plan` before product-code work starts.
- [ ] 3.3 Commit the OpenSpec artifacts before implementation begins.

## 4. Implementation

- [ ] 4.1 Rename active local app source root from `extensions/*` to `apps/*`, preserving Shell, Studio, and Shell-old boundaries according to the confirmed migration scope.
- [ ] 4.2 Update workspace discovery in `package.json`, `pnpm-workspace.yaml`, lockfile, and launcher workspace root resolution to use `apps/*`.
- [ ] 4.3 Update first-party app descriptors, CLI tests, product/app runtime tests, package specs, and root specs from extension terminology to app terminology according to the confirmed naming scope.
- [ ] 4.4 Implement app package compatibility resolution from `peerDependencies.agenter`, including a testable resolver seam for catalog or remote package metadata.
- [ ] 4.5 Update remote fallback command construction so an explicitly selected compatible package version is passed to the Bun runner.
- [ ] 4.6 Update release bundle build/publish scripts and tests for app package roots and bundle package directories.
- [ ] 4.7 Create `skills/create-agenter-app/SKILL.md` with concise progressive-disclosure workflow, reverse peer dependency compatibility guidance, and script usage.
- [ ] 4.8 Create Bun-based `skills/create-agenter-app/scripts` scaffold and validate scripts using `#!/usr/bin/env bun`.
- [ ] 4.9 Ensure skill scripts support repo mode under `apps/*` and external mode with explicit target directories.
- [ ] 4.10 Add concise intent comments only at critical resolver/scaffold effect points where the reverse compatibility or repo/external mode boundary would otherwise be easy to misread.
- [ ] 4.11 Update only current-context completed task checkboxes and commit them with matching implementation and BDD evidence.

## 5. Verification

- [ ] 5.1 Run targeted launcher tests, including `packages/cli/test/product-command-launcher.test.ts`.
- [ ] 5.2 Run targeted app-runtime/descriptor tests, including `packages/product-extension-runtime/test/product-extension-runtime.test.ts` or its renamed successor.
- [ ] 5.3 Run targeted release script tests, including `scripts/release/release-bundles.test.ts`.
- [ ] 5.4 Run skill scaffold/validate tests or direct script smoke tests in repo mode and external temp-directory mode.
- [ ] 5.5 Run residual active-surface audit for `extensions/`, `agenter-ext`, and `product-extension` terms and classify any remaining matches as archived history, explicit legacy compatibility, or bugs.
- [ ] 5.6 Run `bun run openspec:vision -- validate introduce-agenter-app-platform-skill`.
- [ ] 5.7 Run `bun run openspec:vision -- commit-check introduce-agenter-app-platform-skill --phase self-review` before writing final review evidence.

## 6. Self-Review Loop

- [ ] 6.1 Generate `review/self-review.md` comparing implementation against `plans/plan.md`, specs, BDD evidence, and residual-term audit.
- [ ] 6.2 Generate `review/self-review.html` as structured evidence presentation if this change reaches user-facing or release workflow proof that benefits from HTML review.
- [ ] 6.3 If review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 6.4 If the review enters a real loop, run `bun run openspec:vision -- review-state introduce-agenter-app-platform-skill` to persist iteration and recurrence state.
- [ ] 6.5 If review cannot exit normally, run `bun run openspec:vision -- handoff introduce-agenter-app-platform-skill` and commit the handoff evidence before returning to user discussion.
- [ ] 6.6 If review exits normally, sync durable specs, archive the change, and commit the archive result.
- [ ] 6.7 Run `bun run openspec:vision -- check introduce-agenter-app-platform-skill` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

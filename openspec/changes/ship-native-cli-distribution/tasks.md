## 1. Alignment / Investigation

- [ ] 1.1 Confirm the latest `plans/plan.md` records repo truth for the current `agenter` wrapper/package law, the existing release workflow, the accepted tap projection model, and GitHub release archives as binary truth.
- [ ] 1.2 Confirm the spec split remains deliberate: `agenter-native-platform-distribution`, `release-binary-archive-truth`, and `homebrew-cli-projection` each own a distinct durable capability instead of overloading existing ghostty or core-bundle specs.
- [ ] 1.3 Lock the phase-1 native CLI target matrix to `darwin-{arm64,x64}`, `windows-{arm64,x64}`, `linux-{arm64,x64}-gnu`, and `linux-{arm64,x64}-musl`, and record the archive/package naming law before implementation lands.
- [ ] 1.4 Confirm the main repo currently has no root `README.md`, so the documentation deliverable is to create the root README and make it the durable install entrypoint.
- [ ] 1.5 Confirm no task checkbox will be updated unless the agent completed and verified that task in the current working context.

## 2. BDD Contract

- [ ] 2.1 Scenario: Given a supported host installs `agenter` from npm When the install completes Then the public command resolves to the host-native compiled executable instead of a Bun-required JS bundle.
- [ ] 2.2 Scenario: Given install scripts are disabled or platform package placement fails When the operator invokes the documented fallback path Then the wrapper still resolves the same host-native platform package explicitly.
- [ ] 2.3 Scenario: Given a release is cut for a supported target When binary truth is inspected Then GitHub release archives are the canonical source and npm/Homebrew projections resolve to those same archives.
- [ ] 2.4 Scenario: Given a projection publish step runs before the canonical archive exists When release automation checks the target Then the publish step fails before it exposes a broken npm or Homebrew install surface.
- [ ] 2.5 Scenario: Given the Homebrew tap is updated for a release When an operator runs `brew tap jixoai/agenter` and `brew install agenter` Then the formula downloads the canonical host archive, verifies checksum, and installs the native executable directly.
- [ ] 2.6 Scenario: Given the supported target matrix changes When release metadata, npm platform packages, and Homebrew generation inputs are inspected Then all projections expose the same matrix without silent drift.
- [ ] 2.7 Scenario: Given a maintainer inspects one published `@agenter/cli-*` platform package When packaged files are listed Then the package contains only one target’s compiled executable plus minimal metadata.
- [ ] 2.8 Confirm each task checkbox will be updated only by the agent that completed and verified that task in the current working context.

## 3. Implementation

- [ ] 3.1 Run `bun run openspec:vision -- commit-check ship-native-cli-distribution --phase apply` before app-code work starts and commit the ready OpenSpec artifacts.
- [ ] 3.2 Add durable spec updates for `SPEC.md`, `packages/agenter/SPEC.md`, and `packages/cli/SPEC.md` so the published CLI law shifts from ts-first source bin to wrapper-plus-platform-binary distribution backed by GitHub release archives.
- [ ] 3.3 Introduce a single source of truth for the Agenter native CLI platform matrix, archive filenames, archive checksums, and npm/Homebrew projection mapping.
- [ ] 3.4 Add public platform package workspaces for every supported Agenter native target, keeping them thin binary atoms with explicit `os` / `cpu` / `libc` metadata.
- [ ] 3.5 Convert the public `agenter` package into a wrapper shell that uses `optionalDependencies`, `postinstall`, and a documented Node fallback path to reach the host-native compiled executable.
- [ ] 3.6 Compile the Agenter CLI to standalone executables with Bun for every supported target and stage them into the canonical GitHub release archive layout.
- [ ] 3.7 Replace the current JS-bundle-first release bundle path for `agenter` with release-archive-first packaging, while preserving the existing package/release manifest truth model.
- [ ] 3.8 Update release tooling so npm projection packages are built from the canonical release archives instead of independently-built local binaries.
- [ ] 3.9 Update GitHub Actions release automation to use Marketplace actions for Bun setup, GitHub release archive publishing, and downstream formula projection where appropriate.
- [ ] 3.10 Add tap/bootstrap automation that can create or update `jixoai/homebrew-agenter` via `gh`, while keeping formula generation truth in the main repo.
- [ ] 3.11 Generate and project the Homebrew formula from main-repo truth so `brew tap jixoai/agenter` and `brew install agenter` resolve to canonical release archives and checksums.
- [ ] 3.12 Create the root `README.md` and document npm/Homebrew install surfaces, supported targets, and the release/archive truth model.
- [ ] 3.13 Add concise intent comments at the critical effect points for platform resolution, archive truth projection, and Homebrew formula generation.
- [ ] 3.14 Implement any required cleanup or migration of old `agenter` bundle metadata, wrapper scripts, or package fields so the public install surface no longer pretends JS bundles are native binaries.
- [ ] 3.15 Update only current-context completed task checkboxes and commit them with the matching implementation / BDD evidence.

## 4. Verification

- [ ] 4.1 Run targeted tests for platform-matrix resolution, wrapper fallback behavior, and thin platform-package packaging.
- [ ] 4.2 Run targeted release-tooling tests proving GitHub release archives are emitted as canonical binary truth and downstream npm projection consumes them.
- [ ] 4.3 Run targeted Homebrew-generation tests proving formula metadata maps to canonical archive URLs and checksums.
- [ ] 4.4 Run packaging checks (`npm pack --dry-run` or equivalent) for the public `agenter` wrapper and every public `@agenter/cli-*` platform package.
- [ ] 4.5 Run `bun run openspec:vision -- validate ship-native-cli-distribution` for this change.
- [ ] 4.6 Run `bun run openspec:vision -- commit-check ship-native-cli-distribution --phase self-review` before writing final review evidence.
- [ ] 4.7 If GitHub auth is available, create or update the tap repository projection and verify the generated formula content matches main-repo truth; otherwise record the exact blocker and keep the rest of the verification evidence honest.

## 5. Self-Review Loop

- [ ] 5.1 Generate `review/self-review.md` as the macro review thinking record comparing implementation against `plans/plan.md` and all delta specs.
- [ ] 5.2 Generate separate `review/self-review.html` as the structured evidence presentation for release archives, npm wrapper behavior, platform packages, and Homebrew projection.
- [ ] 5.3 If self-review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If review enters a real loop, run `bun run openspec:vision -- review-state ship-native-cli-distribution` to persist iteration / recurrence state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff ship-native-cli-distribution` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `openspec archive ship-native-cli-distribution` and commit the archive result.
- [ ] 5.7 Run `bun run openspec:vision -- check ship-native-cli-distribution` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

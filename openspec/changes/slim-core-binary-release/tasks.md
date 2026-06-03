## 1. Alignment / Investigation

- [x] 1.1 Confirm the latest `plans/plan.md` records repo truth for DuckDB usage, auth-service raster bridging, OpenTUI asset provenance, watcher semantics, and ghostty source-build fallback.
- [x] 1.2 Confirm the spec split remains deliberate: `attention-search-index` and `profile-image-system` are deterministic replacement targets, while watcher backend choice and `.scm/.wasm` slimming still require explicit evidence before any widened architecture move.
- [x] 1.3 Confirm the user-approved `.scm/.wasm` answer is now explicit in the change: retire `@agenter/tui`, rename it to `tui-bak`, and remove it from the live workspace/package graph instead of preserving a bundled core TUI edge.
- [x] 1.4 Lock the phase-1 `@jixo/ghostty-native-*` host matrix to `darwin`, `windows`, `linux-arm64`, and `linux-amd64`, and record that package naming / CI coverage still needs an explicit follow-up decision before implementation lands.
- [x] 1.5 Confirm no task checkbox will be updated unless the agent completed and verified that task in the current working context.

## 2. BDD Contract

- [x] 2.1 Scenario: Given persisted attention commits and no index When the runtime rebuilds search Then Bun SQLite FTS5 restores the projection without a second canonical store.
- [x] 2.2 Scenario: Given a legacy DuckDB sidecar remains in a session root When the new attention search runtime starts Then the legacy file does not block rebuildable search semantics.
- [x] 2.3 Scenario: Given a search query uses `hash`, `score`, `depth`, or `minscore` filters When SQLite FTS5 narrows candidates Then final results still obey attention graph semantics.
- [x] 2.4 Scenario: Given a supported release install serves an SVG-backed icon When the default raster media path is used Then the server resolves packaged `@resvg/resvg-js` support without a repo-local bridge build.
- [x] 2.5 Scenario: Given a host lacks a supported packaged raster runtime When icon rasterization is requested Then the failure is explicit instead of silently pretending raster support exists.
- [x] 2.6 Scenario: Given `bundle/agenter` emits `.node`, `.wasm`, or `.scm` assets When release provenance is inspected Then each asset has an explicit owner, command surface, and runtime load path.
- [x] 2.7 Scenario: Given the legacy core TUI is retired and removed from the live workspace graph When the core bundle boundary is reviewed Then `bundle/agenter` no longer inherits OpenTUI syntax `.scm/.wasm` assets from that edge.
- [x] 2.8 Scenario: Given a user runs `agenter tui` after TUI retirement When command resolution runs Then the launcher rejects it as unsupported and does not resolve `tui-bak` as a live app.
- [x] 2.9 Scenario: Given a supported phase-1 host (`darwin`, `windows`, `linux-arm64`, or `linux-amd64`) requests the `ghostty-native` backend When runtime resolution runs Then the umbrella package resolves the installed platform package instead of invoking a local build helper.
- [x] 2.10 Scenario: Given an unsupported host requests `ghostty-native` When runtime resolution fails Then the backend reports a clear unsupported-platform error.
- [x] 2.11 Scenario: Given `@jixo/reactive-fs` currently depends on missing-path watch, multi-root pooling, and recovery semantics When Bun watcher parity is evaluated Then the change records supported and missing semantics before any replacement lands.
- [x] 2.12 Confirm each task checkbox will be updated only by the agent that completed and verified that task in the current working context.
- [x] 2.13 Scenario: Given a maintainer runs the explicit host-only smoke path on the current host When release bundle preparation runs Then only the current-host ghostty platform package is staged and bundled and the result does not masquerade as full-matrix release output.
- [x] 2.14 Scenario: Given the new `@jixo/ghostty-native-*` packages are still missing in npm When bootstrap runs live Then each missing platform package can be initially published and prepared for trusted publishing without secret leakage.

## 3. Implementation

- [x] 3.1 Run `bun run openspec:vision -- commit-check slim-core-binary-release --phase apply` before app-code work starts and commit the ready OpenSpec artifacts.
- [x] 3.2 Replace the attention-search DuckDB index store with a Bun SQLite + FTS5 implementation while preserving rebuildable projection semantics and current query behavior.
- [x] 3.3 Decide the canonical SQLite sidecar filename and implement the legacy DuckDB cleanup/rebuild path consistent with the rebuildable-projection law.
- [x] 3.4 Replace the auth-service raster bridge path with packaged `@resvg/resvg-js` resolution and remove release/bootstrap wiring that assumes `libprofile_resvg_bridge.*` is required at runtime.
- [x] 3.5 Add concise intent comments at the critical effect points for search projection migration, raster-runtime resolution, and release asset provenance.
- [x] 3.6 Produce a release asset provenance audit for `bundle/agenter`, including the current `highlights-*.scm`, `injections-*.scm`, `tree-sitter-*.wasm`, and surviving `.node` assets.
- [x] 3.7 Retire `@agenter/tui` from the live product surface: rename the project to `tui-bak`, remove it from the workspace graph, and ensure release/publish tooling no longer treats it as a live package atom.
- [x] 3.8 Remove the core CLI `tui` command surface and route `agenter tui` through the unsupported-command path instead of any descriptor, workspace, or remote fallback.
- [x] 3.9 Verify that retiring the live TUI edge removes the OpenTUI syntax `.scm/.wasm` assets from `bundle/agenter`, and update release boundary tests so the regression is caught before publish.
- [x] 3.10 Evaluate Bun watcher against current `@jixo/reactive-fs` semantics; only replace `@parcel/watcher` if parity is proven for missing-path watch, multi-root support, and recovery behavior.
- [x] 3.11 Introduce the umbrella-plus-platform-package distribution model for `@jixo/ghostty-native` and update runtime resolution to prefer installed platform artifacts on supported hosts.
- [x] 3.12 Update release manifests, publish order, and package metadata so ghostty platform packages and any surviving external native dependencies remain explicit install-time/runtime atoms.
- [x] 3.13 Update only current-context completed task checkboxes and commit them with matching implementation and BDD evidence.
- [x] 3.14 Add an explicit host-only smoke command/mode for release bundle preparation that validates current-host staging and bundle metadata without requiring foreign ghostty artifacts or changing full release semantics.
- [x] 3.15 Run live bootstrap/publish for the missing `@jixo/ghostty-native-*` packages and record the registry/trust outcome for this change.

## 4. Verification

- [x] 4.1 Run targeted attention-search tests covering rebuild, graph semantics, and legacy DuckDB-sidecar compatibility.
- [x] 4.2 Run targeted auth-service tests covering packaged raster runtime resolution and explicit unsupported-host failure behavior.
- [x] 4.3 Run release bundle tests covering DuckDB removal, asset provenance, and any explicit app-owned `.scm/.wasm` decision.
- [x] 4.4 Run targeted ghostty distribution tests covering supported-host platform resolution and unsupported-host diagnostics.
- [x] 4.5 Capture watcher parity evidence and record whether Bun watcher replaces `@parcel/watcher` or is explicitly deferred.
- [x] 4.6 Run `bun run openspec:vision -- validate slim-core-binary-release` for this change.
- [x] 4.7 Run `bun run openspec:vision -- commit-check slim-core-binary-release --phase self-review` before writing final review evidence.
- [x] 4.8 Run targeted release bundle tests plus the host-only smoke command to prove current-host staging works without foreign platform artifacts.
- [x] 4.9 Verify the newly bootstrapped ghostty platform packages are visible in npm and that the publish/trust path leaves no secret-bearing residue in the repo.

## 5. Self-Review Loop

- [x] 5.1 Generate `review/self-review.md` as the macro review thinking record comparing implementation against `plans/plan.md` and all delta specs.
- [x] 5.2 Generate separate `review/self-review.html` as the structured evidence presentation for bundle provenance, raster/runtime behavior, and ghostty platform resolution.
- [x] 5.3 If self-review updates OpenSpec artifacts or reopens tasks, commit those artifact changes before the next apply loop.
- [ ] 5.4 If review enters a real loop, run `bun run openspec:vision -- review-state slim-core-binary-release` to persist iteration / recurrence state.
- [ ] 5.5 If review cannot exit normally, run `bun run openspec:vision -- handoff slim-core-binary-release` and commit the handoff evidence before returning to user discussion.
- [ ] 5.6 If review exits normally, run `openspec archive slim-core-binary-release` and commit the archive result.
- [ ] 5.7 Run `bun run openspec:vision -- check slim-core-binary-release` and decide whether to exit or return to `research-plan` with a backed-up plan revision.

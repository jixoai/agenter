# Intent Document

## Current Round

- Round: 3
- Status: The `.scm/.wasm` investigation is complete, the ghostty phase-1 host matrix is locked, and the user chose the concrete scope answer: retire `@agenter/tui`, rename it to `tui-bak`, and remove it from the workspace graph.
- Previous plan backup: none

## Workflow Command Surface

- Create change: `bun run openspec:vision -- new <change>`
- Check status: `bun run openspec:vision -- status <change>`
- Get artifact instructions: `bun run openspec:vision -- instructions <artifact> <change>`
- Strictly validate change files: `bun run openspec:vision -- validate <change>`
- Check commit evidence: `bun run openspec:vision -- commit-check <change> --phase <phase>`
- Rename after intent realignment: `bun run openspec:vision -- rename <old-change> <new-change>`
- Write abnormal-exit handoff: `bun run openspec:vision -- handoff <change>`
- Final workflow proof gate: `bun run openspec:vision -- check <change>`

## Original User Input

> 因为我们目前强依赖了bun，为了更好的分发，我希望直接分发二进制

> 我们需要讨论一下方案

> 0. 坚持使用bun作为底层平台
> 1. 首先我希望移除对 @duckdb/node-api 的依赖。目前duckdb的依赖更多是残留依赖吧，完全可以用bun sqlite替代？
> 2. resvg这个目前只编译了macOS的动态链接库, 我觉得可以改成依赖 @resvg/resvg-js，它提供了多平台的原生支持
> 3. 目前dist路径内容如下：
> ```
> agenter.js application/javascript 13.6 MB
> highlights-eq9cgrbb.scm application/vnd.lotus-screencam 9.83 kB
> highlights-ghv9g403.scm application/vnd.lotus-screencam 2.86 kB
> highlights-hk7bwhj4.scm application/vnd.lotus-screencam 3.48 kB
> highlights-r812a2qc.scm application/vnd.lotus-screencam 3.44 kB
> highlights-x6tmsnaa.scm application/vnd.lotus-screencam 2.15 kB
> injections-73j83es3.scm application/vnd.lotus-screencam 815 B
> resvgjs.darwin-arm64-h8sackw6.node text/plain 3.54 MB
> tree-sitter-javascript-nd0q4pe9.wasm application/wasm 412 kB
> tree-sitter-markdown-411r6y9b.wasm application/wasm 422 kB
> tree-sitter-markdown_inline-j5349f42.wasm application/wasm 426 kB
> tree-sitter-typescript-zxjzwt75.wasm application/wasm 1.41 MB
> tree-sitter-zig-e78zbjpm.wasm application/wasm 692 kB
> ```
> 除了我前面说的，还有什么可以剔除掉哦

> 所以第一阶段，我们的任务就是：
>
> 1. duckdb 确定是可以剔除的，Bun Sqlite 自带 FTS5 已经能满足我们的需求
> 2. 换成 @resvg/resvg-js
> 3. 调查 scm 文件是什么作用？ tree-sitter-*.wasm 文件是什么作用？
> 4. 调查 Bun Fs Watcher 的底层实现？能否替代 @parcel/wacher (如果有必要，可以做实验，最好先找找资料看看源代码，来得实在)
> 5.  @jixo/ghostty-native 这个不可避免，因为是我们自己维护的内核，做了一些改造，所以得考虑分发不同平台的支持（`@jixo/ghostty-native-(windows|darwin|linux)-*`, 这是缺的，所以这次变更也得顺便做了）

> 1/3: 先调查出结论再说
> 2: 支持darwin|windows|linux-arm64|amd64

> tui这个项目可以废弃，直接改名成  tui-bak ，并从workspace中剔除。

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Binary distribution must remain Bun-first. | This change cannot solve bundle size by de-Bunifying the platform. |
| 2 | User | `@duckdb/node-api` should leave phase 1; Bun SQLite + FTS5 is accepted as the replacement target. | The search sidecar contract must move off DuckDB while preserving rebuildable projection semantics. |
| 3 | User | The current auth-service raster path should move from a macOS-only native bridge to `@resvg/resvg-js`. | The SVG raster path must become a packaged multi-platform dependency instead of a repo-local compiled bridge. |
| 4 | User | `highlights-*.scm` and `tree-sitter-*.wasm` must be investigated before deciding whether they can be removed. | The bundle needs an asset provenance law, not just ad hoc deletion. |
| 5 | User | Bun watcher versus `@parcel/watcher` must be evaluated from docs/source/real semantics, and experiment only if needed. | Watcher replacement is evidence-first and must not be pre-decided in the artifact. |
| 6 | User | `@jixo/ghostty-native` is unavoidable, but phase 1 must add multi-platform distribution support under the Jixo namespace. | Ghostty needs a packaging/runtime-resolution law, not removal. |
| 7 | User | For the `.scm/.wasm` question, investigate first and only then decide whether a boundary change is needed. | Phase 1 must not pre-approve a core/app boundary rewrite. |
| 8 | User | Ghostty phase-1 support matrix is `darwin|windows|linux-arm64|amd64`. | The distribution contract can now encode the first supported host set explicitly. |
| 9 | User | The TUI project can be retired, renamed to `tui-bak`, and removed from the workspace. | The OpenTUI asset conclusion is no longer abstract; phase 1 may sever the live TUI workspace/package edge. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/app-server/src/attention-search/index-store.ts` | Attention search currently creates a DuckDB file, installs/loads the DuckDB `fts` extension, and queries candidates from that sidecar. | `@duckdb/node-api` is active runtime truth, not dead residue. |
| `packages/app-server/src/app-kernel.ts` and `packages/app-server/src/session-runtime.ts` | The runtime currently names the projection file `attention-search.duckdb`. | The DuckDB-to-SQLite change touches the operator-visible sidecar boundary and migration/cleanup path. |
| `openspec/specs/attention-search-index/spec.md` | The durable capability currently says attention search SHALL use a rebuildable DuckDB FTS projection. | The change must modify an existing platform law, not only code. |
| `packages/auth-service/src/render/resvg-ffi.ts` | The raster path currently uses `bun:ffi`, loads `libprofile_resvg_bridge.*`, and may invoke Cargo to build the bridge binary. | The current SVG raster contract is source-build-oriented and host-fragile. |
| `packages/auth-service/SPEC.md` | Auth-service durable package notes still say raster variants come from `bun:ffi + resvg bridge`. | The implementation phase must reconcile package-level durable law, not only OpenSpec deltas. |
| `scripts/release/release-manifest.ts` and `packages/cli/src/run-cli.ts` | The release bundle currently copies the auth-service `resvg_bridge` native asset and the CLI passes a bridge library path into auth-service startup. | Replacing the bridge requires release-manifest, CLI bootstrap, and auth-service contract changes together. |
| `bun.lock` | `@resvg/resvg-js` is already present as an optional dependency through `@termless/core`. | Replacing the auth-service bridge does not automatically mean every `resvgjs*.node` file disappears from the final bundle. Provenance still matters. |
| `node_modules/.pnpm/@opentui+core@0.2.14_typescript@6.0.3_web-tree-sitter@0.25.10/node_modules/@opentui/core/package.json` and `README.md` | `@opentui/core` exports tree-sitter support and documents syntax-highlighting integration via `web-tree-sitter`. | The `.scm` and `.wasm` files are not random bundle trash; they belong to OpenTUI syntax infrastructure. |
| `node_modules/.pnpm/@opentui+core@0.2.14_typescript@6.0.3_web-tree-sitter@0.25.10/node_modules/@opentui/core/index-3fq5hq97.js` | OpenTUI directly imports `assets/*/highlights.scm`, `assets/markdown/injections.scm`, and `assets/*/tree-sitter-*.wasm` as runtime file assets. | The current `dist` payload is inheriting these assets from a concrete runtime import path. |
| `packages/cli/src/run-cli.ts` and `packages/tui/package.json` | The CLI has a `tui` command that dynamically imports `@agenter/tui`, and `@agenter/tui` depends on `@opentui/core`. | The current core bundle can inherit OpenTUI assets because an optional TUI command path lives inside the same publishable package. |
| `packages/tui/src/run-tui.ts` and targeted `rg` over `packages/tui`, `packages/cli`, and `apps/shell/src` | The current core TUI uses generic OpenTUI renderer primitives, but this path does not itself reference tree-sitter, parser workers, or syntax-highlighting APIs. | The `.scm/.wasm` payload is being dragged in by the monolithic `@opentui/core` entry, not by intentional syntax-highlighting use in `@agenter/tui`. |
| `bun build packages/agenter/src/bin/agenter.ts --bundle --target=bun --outdir /tmp/agenter-bundle-probe --external @duckdb/node-api --external @jixo/ghostty-native --external @parcel/watcher` | A direct bundle probe reproduces the user-reported payload: `agenter.js` at 13.61 MB plus the same OpenTUI `.scm/.wasm` assets. | This confirms the release payload is not an artifact of an unrelated build script; it comes from the actual bundle edge. |
| `bun build ... --external @agenter/tui` to `/tmp/agenter-bundle-probe-no-tui` | Externalizing `@agenter/tui` shrinks `agenter.js` to 11.93 MB and removes all OpenTUI `.scm/.wasm` assets, leaving only the surviving `resvgjs*.node` asset. | Under the current topology, the OpenTUI payload enters `bundle/agenter` through the bundled TUI atom. |
| `node_modules/.pnpm/@opentui+core@0.2.14.../package.json` exports surface | `@opentui/core` exposes only the monolithic main entry plus testing/runtime-plugin helpers; it does not expose a public lean renderer-only entrypoint. | There is no clean exported subpath today that would let `@agenter/tui` keep using OpenTUI while avoiding the syntax asset imports. |
| `packages/cli/SPEC.md` | The package-level durable notes still list `tui` as a core bootstrap surface. | Retiring `@agenter/tui` requires an explicit CLI-surface cleanup, not just bundle surgery. |
| `packages/reactive-fs/package.json` and `packages/reactive-fs/src/reactive-fs/*` | `@jixo/reactive-fs` currently depends on `@parcel/watcher` and already relies on missing-path support, multi-root watchers, pooling, reinitialization, and explicit watcher status. | Bun watcher replacement is not a drop-in assumption; parity has to be proven against current semantics. |
| `packages/termless-core/src/backend-factory.ts` | `@termless/core` resolves `@jixo/ghostty-native`, checks for `termless-ghostty-native.node`, and falls back to running `build/build.sh` if the artifact is missing. | Current ghostty distribution still assumes source-build fallback instead of prebuilt install-time platform ownership. |
| `packages/ghostty-native/package.json` and `scripts/release/release-manifest.ts` | The repo currently publishes a single `@jixo/ghostty-native` package and a single release bundle atom for it. | The multi-platform package matrix the user asked for is not modeled yet. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending artifact creation and validation |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not started |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not started |
| Normal archive | Commit containing `openspec archive <change>` result | Not started |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not started |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/attention-search-index/spec.md` | Rebuildable search projection is already a durable capability, but it hardcodes DuckDB FTS. | Extend by replacing the engine law while preserving query semantics. |
| `openspec/specs/profile-image-system/spec.md` | The system already requires server-side rasterization through resvg for default icon delivery. | Extend with packaged multi-platform runtime law. |
| `openspec/specs/termless-backend-adoption/spec.md` | Ghostty already owns the official Termless backend slot. | Reuse the ownership slot and add a separate distribution capability instead of inventing another backend identity. |
| `openspec/changes/file-backed-prompt-authority/specs/release-native-dependency-boundary/spec.md` | Native dependency externalization is already modeled as a release/platform law with release tests. | Reuse the pattern for binary asset provenance and platform package publishing. |
| `scripts/release/release-bundles.test.ts` | The repo already treats release bundle boundaries as BDD-style contract tests. | Reuse this as the verification home for phase-1 bundle law. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `坚持使用bun作为底层平台` | Distribution cleanup must stay inside the Bun runtime model. | Keep Bun; shrink and clarify what rides with it. |
| `直接分发二进制` | Supported hosts should install prebuilt runtime atoms instead of compiling local bridges/backends during normal setup. | The release story should feel installable, not build-your-own. |
| `剔除掉` | Any payload without durable value or explicit ownership should leave the core bundle. | No unexplained hitchhikers in `dist`. |
| `第一阶段` | Scope is intentionally limited; later phases can exist. | Solve the first durable layer cleanly instead of overreaching. |
| `调查...来得实在` | Claims must come from repo truth, package source, docs, or a targeted spike. | Evidence first, then decision. |
| `不可避免` | Some native/runtime atoms are required and should be distributed correctly, not removed performatively. | Ghostty stays; its packaging law changes. |
| `先调查出结论再说` | Do not widen into a package-boundary change before the provenance conclusion exists. | Audit first, escalate second. |
| `支持darwin|windows|linux-arm64|amd64` | Ghostty phase-1 no longer has an open-ended platform matrix. | Encode these hosts directly into the distribution contract. |
| `可以废弃` | The current TUI surface no longer needs preservation as a live product. | Retirement is acceptable if the boundary cleanup is explicit. |
| `改名成 tui-bak，并从workspace中剔除` | The old code may remain only as backup material, not as a participating package. | Remove it from the live workspace/package graph rather than carrying a hidden active edge. |

## Current Round Conclusions

### Watcher Parity Conclusion

The watcher question now has a phase-1 answer: **do not replace `@parcel/watcher` yet**.

Why:

- Repo truth in `packages/reactive-fs/src/reactive-fs/*` and its tests shows the current contract already depends on:
  - watching paths that do not exist yet,
  - multi-root watcher pooling,
  - recursive child watching for directories,
  - runtime-status inspection,
  - recovery/reinitialize reasons such as `drop-events`, `watcher-error`, `missing-project-dir`, and `project-dir-replaced`.
- Bun’s public watcher surface is the Node-compatible `fs.watch(...)` API, while Bun’s watch-mode docs only establish that it uses native platform facilities such as `kqueue()` and `inotify()`; they do not establish parity with the higher-level semantics `@jixo/reactive-fs` already consumes.
- Direct local evidence from this round:
  - watching a nonexistent path with Bun `fs.watch(...)` failed immediately with `ENOENT`,
  - recursively watching an existing root and then creating `nested/a.txt` produced only `rename:nested`, which is weaker than the current directory-child semantics the reactive-fs tests assume.

Therefore phase 1 should record an explicit **defer** decision: keep `@parcel/watcher` as the install-time/runtime watcher dependency until parity is proven against the existing contract, rather than replacing it by assumption.

### Core Bundle Asset Provenance Audit

The current `bundle/agenter` asset story is now explicit enough to explain:

| Asset family | Owning package | Command / feature surface | Runtime load path | Current phase-1 status |
| ------------ | -------------- | ------------------------- | ----------------- | ---------------------- |
| `highlights-*.scm` | `@opentui/core` | legacy `agenter tui` surface via `@agenter/tui` | `@agenter/tui` -> monolithic `@opentui/core` main entry -> syntax asset imports | no longer emitted in `bundle/agenter` after TUI retirement |
| `injections-*.scm` | `@opentui/core` | legacy `agenter tui` surface via `@agenter/tui` | `@agenter/tui` -> monolithic `@opentui/core` main entry -> markdown injection asset import | no longer emitted in `bundle/agenter` after TUI retirement |
| `tree-sitter-*.wasm` | `@opentui/core` / `web-tree-sitter` integration | legacy `agenter tui` surface via `@agenter/tui` | `@agenter/tui` -> monolithic `@opentui/core` main entry -> parser/grammar asset imports | no longer emitted in `bundle/agenter` after TUI retirement |
| `resvgjs.<platform>.node` | `@resvg/resvg-js-<platform>` via `@resvg/resvg-js` | auth-service default SVG -> raster media path | `packages/auth-service/src/render/resvg-runtime.ts` -> `import("@resvg/resvg-js")` -> package `js-binding.js` -> platform native binding | still emitted while the core bundle inlines auth-service rasterization support |

Direct bundle probe after the TUI retirement and packaged resvg swap now produces only:

- `agenter.js`
- `resvgjs.darwin-arm64-*.node` on the current darwin/arm64 host

The old `.scm/.wasm` payloads were real OpenTUI syntax assets, not random bundler trash, but they are no longer core-bundle assets once the live TUI edge is removed.

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none yet | The current artifact round did not need a change-local spike to resolve intent. | Revisit only if watcher parity or asset provenance cannot be answered from source and tests. |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Does phase 1 need an actual Bun watcher replacement, or only a proved keep/replace conclusion? | The semantic gap may be real, and forcing replacement without parity would violate the evidence-first rule. | Replacement lands only if parity is proven; otherwise parcel stays with a written reason. |
| Should the canonical search sidecar filename change away from `attention-search.duckdb` in the same phase? | The engine swap is accepted, but the file-visible migration boundary still needs an explicit choice. | Prefer an explicit SQLite filename because the sidecar is rebuildable projection state, not durable truth. |
| Should ghostty platform packages encode libc in the package name for Linux, or stay at the user-approved `linux-arm64` / `linux-amd64` surface without a libc split? | The approved host set is concrete, but install-time package names and supported Linux runtime policy are still under-specified. | Do not guess; hold implementation until the package naming and libc policy are explicit. |

## Intent

### Surface Intent

Make phase 1 of binary slimming concrete: keep Bun as the platform, remove DuckDB from the core runtime, replace the auth-service resvg bridge with `@resvg/resvg-js`, explain what the `scm`/`wasm` payloads are and whether they belong in the core bundle, evaluate Bun watcher versus `@parcel/watcher` from real semantics, and give `@jixo/ghostty-native` a real multi-platform distribution story.

### Underlying Drive

The current release shape still mixes several different kinds of truth:

1. Core runtime atoms that are actually needed for the main `agenter` binary.
2. Rebuildable projection engines that can change without changing user data truth.
3. App-owned or TUI-owned syntax assets that are sneaking into the core bundle through transitive imports.
4. Native dependencies that are unavoidable, but whose ownership and install path are under-modeled.

The deeper pressure is not only “make `dist` smaller”. It is to make the binary’s payload explainable. Every native binding, wasm blob, query file, and sidecar engine should either have a durable reason to exist or leave the core bundle.

### Final Visible Effect

When phase 1 is correct, an operator or release engineer can inspect the publishable atoms and stop worrying about hidden baggage:

- `bundle/agenter` no longer depends on DuckDB.
- The default SVG raster path no longer depends on a repo-local Rust bridge build just to run on a supported host.
- Every `.node`, `.wasm`, and `.scm` asset in the release output has an explicit owner, command surface, and runtime load path.
- `@jixo/ghostty-native` resolves through install-time platform packages on supported hosts instead of compiling from source as the default release story.
- The watcher question has a written answer backed by semantics, not a guess.

## Platform Diagnosis

- Current platform laws:
  - Attention search is a rebuildable projection, but its durable spec still hardcodes DuckDB.
  - Profile/session icon delivery already requires server-side rasterization through resvg.
  - Ghostty already owns the official Termless backend slot.
  - Native dependency boundaries are already treated as first-class release law in adjacent changes.
- Does this fit as a regular atom: no.
- Does this require law upgrade: yes. The repo already has atoms for search, rasterization, and backend ownership, but core-binary asset ownership and platform-package distribution are still under-specified.
- Breaking update stance: prefer breaking cleanup for rebuildable projections, native bridge removal, and release packaging. Do not silently change CLI command surfaces or supported host claims without explicit confirmation.
- User confirmations still required:
  - Whether the search sidecar filename change should land in the same phase as the engine swap.

## Reverse-Inferred Design

### Interaction / Visual Story

After `bun run release:build-bundles`, a maintainer can inspect the bundle manifests and understand every payload:

```text
bundle/agenter
  dist/agenter.js
  dependencies:
    @jixo/ghostty-native
    @parcel/watcher
    @termless/core
  native assets:
    explicit owner + load reason for each .node/.wasm/.scm
  removed:
    DuckDB runtime dependency
    auth-service resvg bridge if replaced by packaged runtime
```

On a supported host, starting the daemon or rasterizing a profile icon does not trigger Cargo or Zig just to produce a missing native artifact. If some syntax-highlighting asset stays, the manifest can explain why it belongs to the owning app surface.

### Interface Shape

- Attention search keeps the same query surface and graph semantics, but its storage engine contract becomes “Bun SQLite + FTS5 rebuildable sidecar”.
- Auth-service keeps the same external icon/media endpoints, but its raster runtime contract becomes “packaged multi-platform resvg implementation” instead of “repo-local bridge library path”.
- Release bundle contracts gain an asset provenance layer: package owner, command surface, runtime load path, and whether an asset is core-owned or app-owned.
- `@jixo/ghostty-native` keeps the same public JS API for consumers, but runtime resolution changes from “find local `.node` or build it” to “resolve installed platform package or fail clearly”, with phase-1 support covering `darwin`, `windows`, `linux-arm64`, and `linux-amd64`.
- `@jixo/reactive-fs` keeps its current semantics unless a Bun watcher proves semantic parity; watcher backend choice remains an internal implementation detail behind the same contract.

### Data Shape

- Durable facts:
  - Search projection engine contract and sidecar ownership policy
  - Profile-image raster runtime contract
  - Release bundle package specs, dependency metadata, and asset provenance records
  - Ghostty platform package namespace and supported target triples
- Projections:
  - `dist` file list and publish manifest
  - Runtime “backend available / unavailable” diagnostics
  - Watcher parity decision record
- Must not confuse:
  - Rebuildable search index with durable attention truth
  - A transitive asset appearing in `dist` with a justified release ownership decision
  - Dev-source fallback build helpers with the supported production install path

### Architecture Shape

- The attention-search atom changes engine, but not durable query meaning.
- The profile-image atom changes raster runtime packaging, but not endpoint semantics.
- A new core-binary asset-boundary law becomes the place where `.scm/.wasm/.node` ownership is decided explicitly.
- Ghostty distribution becomes two layers: umbrella JS API plus host-specific native packages under the Jixo namespace for `darwin`, `windows`, `linux-arm64`, and `linux-amd64`.
- The current OpenTUI asset conclusion is structural: as long as `bundle/agenter` bundles `@agenter/tui`, and `@agenter/tui` imports the monolithic `@opentui/core` entry, the syntax assets stay. The user-approved answer is to retire that live TUI edge: rename the package to `tui-bak`, remove it from the workspace graph, and stop treating it as a core CLI surface.
- Watcher backend remains behind `@jixo/reactive-fs`; the change may keep `@parcel/watcher` if Bun watcher does not match current semantics.

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Search sidecar filename migration | The engine swap is approved, but visible on-disk naming may still matter operationally. | Prefer an explicit SQLite name because the sidecar is rebuildable projection state. |
| Ghostty platform package naming / Linux libc policy | Phase-1 host families are approved, but exact install-time package atoms are not. | Keep the host matrix explicit, but do not invent package names or libc splits until confirmed. |

## Intent-Driven Plan

- [ ] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should the search sidecar filename change now or in a later cleanup? | The engine swap can ship either with or without an on-disk rename. | Prefer the rename now because the sidecar is disposable projection state. |
| Should Linux ghostty binaries split by libc in phase 1, and if so what package names should become canonical? | Runtime resolution and publish order cannot be implemented cleanly until the platform atoms are named. | Hold the ghostty package implementation until the package naming rule is explicit. |
| Is Bun watcher replacement part of phase 1 deliverable, or only a proved decision? | This determines whether a failed parity spike is acceptable output. | A proved keep/replace decision is sufficient; replacement itself is conditional. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep DuckDB because it is already wired up | It preserves a native dependency the user explicitly wants gone and keeps the main-spec law out of sync with the desired platform direction. |
| Replace `@parcel/watcher` with Bun watcher by assumption | Current `@jixo/reactive-fs` semantics include missing-path watch, root pooling, and recovery signals that are not yet proven equivalent in Bun watcher. |
| Delete `.scm/.wasm` files as if they were generic dead assets | Repo truth shows they are concrete OpenTUI syntax-highlighting assets with real runtime import paths. |
| Keep auth-service rasterization on a repo-local Rust bridge for release installs | That contradicts the multi-platform packaged-runtime requirement and keeps Cargo in the default runtime story. |
| Treat local ghostty source build as the release story | The user asked for binary distribution; source build can remain a developer fallback, not the supported install path. |
| Assume `@resvg/resvg-js` replacement alone removes every resvg native artifact from `dist` | `bun.lock` already shows `@resvg/resvg-js` can also arrive through `@termless/core`, so provenance still must be audited. |

## Exit Conditions

- Default max review iterations: 5
- Issue recurrence threshold: 2 consecutive review rounds
- Custom exit condition from intent:
  - `plans/plan.md`, specs, and `tasks.md` must cover all five phase-1 scope items.
  - The artifacts must distinguish deterministic replacement work from evidence-first investigation work.
  - The ghostty phase-1 distribution contract must encode `darwin|windows|linux-arm64|amd64` as the approved first support matrix.
  - The TUI retirement path must be explicit: `@agenter/tui` leaves the live workspace/package graph and no longer keeps OpenTUI syntax assets inside `bundle/agenter`.
  - No un-discussed platform-matrix or compatibility-shim decision should be hidden inside the artifacts.

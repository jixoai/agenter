# Intent Document

## Current Round

- Round: 1
- Status: investigation complete; user confirmed tap projection, Linux musl coverage, and GitHub release binary archives as the binary truth
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
>
> 我们目前还是需要往独立二进制的方向去演进，我的想法是：
>
> 1. 直接使用bun进行打包，然后发布 `@agenter/cli-[windows|darwin|linux]-*` 这样的包， 而agenter只是一个入口。
>
> 在npm上发布二进制，目的是即便是使用node npm 去安装，下载下来后，node也只是一个启动入口，最终启动的还是以bun为基础的二进制可执行文件。
>
> 开始之前需要调查一下类似的思路，就是， `@anthropic-ai/claude-code/package.json` ……
>
> 以它为最佳实践。
>
> 2. 本地有brew命令，我需要你配置一下brew（是 Formula 模板没错吧），然后更新主仓库的 README.md
> 最终要达到的效果是：
>
> `brew tap jixoai/agenter`
> `brew install agenter`
>
> 至于windows/linux平台的，你看着能支持就顺便一起支持了
>
> 使用openspec vision进行推进

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | Agenter distribution should evolve toward standalone binaries because Bun is already a hard runtime dependency. | This is not just packaging polish; it changes the public install law. |
| 2 | User | Public npm shape should follow `agenter` as the entry package and `@agenter/cli-[platform]-*` as platform binary packages. | The current `agenter` ts-first source-bin law is no longer sufficient. |
| 3 | User | `@anthropic-ai/claude-code` is the benchmark pattern to investigate before implementation. | External prior art must be studied before writing specs. |
| 4 | User | Homebrew support should reach `brew tap jixoai/agenter` then `brew install agenter`, and the main repo README must explain it. | This adds a second distribution projection and a repo-topology question. |
| 5 | User | A dedicated tap repo is acceptable; if `gh` works the agent can create and push it. | Tap projection can be automated rather than deferred. |
| 6 | User | Linux support should include musl targets; use Bun’s official target table. | The platform matrix now includes glibc and musl Linux pairs. |
| 7 | User | The true binary authority is GitHub release binary archives; CI/CD should package those archives into npm as well. | GitHub Releases, not npm tarballs, must become the canonical binary source. |
| 8 | User | CI/CD should prefer suitable Marketplace Actions instead of hand-rolled release plumbing where a good action already exists. | Marketplace selection is a real design input, not an implementation afterthought. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `packages/agenter/SPEC.md` | `agenter` is currently defined as a Bun-first public release shell whose `bin` points directly at source. | The requested binary-wrapper model breaks an explicit current law. |
| `packages/cli/SPEC.md` | `@agenter/cli` is the launcher/bootstrap authority and stays app-agnostic. | Compiled binaries should project this launcher law rather than invent a second launcher. |
| `scripts/release/release-manifest.ts` | Current `bundle/agenter` publishes `dist/agenter.js` plus Bun wrapper scripts; it does not model compiled CLI platform packages. | Existing release topology must be upgraded, not merely documented. |
| `scripts/release/build-bundles.ts` | Current release build uses `bun build --bundle --target=bun`, copies assets, and emits JS bundles. | The build path is still bundle-first, not standalone-executable-first. |
| `.github/workflows/release.yml` | Current trusted publishing workflow already has multi-runner native artifact staging and a publish job. | There is enough release infrastructure to host a CLI platform matrix and Homebrew metadata generation. |
| `SPEC.md` release law | `release-manifest.ts` is the single source of truth for publishable npm packages, and staged binary package dirs are publish-time surfaces rather than source truth. | Any CLI platform package matrix should reuse this law instead of inventing a second manifest source. |
| repo root | The main repo currently has no root `README.md`. | The request to update the main repo README implies creating one or changing repo documentation topology. |
| `npm view @anthropic-ai/claude-code@2.1.161` + tarball inspection | Claude Code uses one entry package with `optionalDependencies`, `postinstall`, a fixed `bin/claude.exe` placeholder, and platform packages that only contain the native binary. | The requested best-practice sample is confirmed, not inferred. |
| Homebrew docs | Short `brew tap user/repository` expects a GitHub repo, and GitHub-hosted short-name taps are expected to use `homebrew-` repository naming. | The desired command `brew tap jixoai/agenter` implies a tap repo topology decision. |
| Bun executable docs | Bun officially supports `bun-darwin-{arm64,x64}`, `bun-windows-{arm64,x64}`, `bun-linux-{x64,arm64}`, and `bun-linux-{x64,arm64}-musl`. | Linux musl support is a real option, not hand-wavy wishful thinking. |
| GitHub Marketplace: `oven-sh/setup-bun` | Verified Marketplace action; current latest is `v2.2.0`; it installs Bun based on explicit version or `packageManager`. | This is the right Bun setup action for the release workflow. |
| GitHub Marketplace: `softprops/action-gh-release` | Current latest is `v3.0.0`; it supports tag-gated releases and newline-delimited asset globs, and updates an existing release when the tag already exists. | This is a good fit for publishing GitHub release binary archives as the primary binary truth. |
| GitHub Marketplace: `Justintime50/homebrew-releaser` | It can generate formulae and push to a tap, but its docs explicitly say it is not compatible with monorepos. | Reject for this repo. |
| GitHub Marketplace / repo: `mislav/bump-homebrew-formula-action` | Minimal action for updating a formula in an external tap repo; supports custom `download-url` and recomputes `sha256`, but requires a write token for the tap repo. | This is the best fit for keeping formula truth generated from this repo while projecting to a separate tap repo. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Not started |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Not started |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Not started |
| Normal archive | Commit containing `openspec archive <change>` result | Not started |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not started |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/changes/archive/2026-06-03-slim-core-binary-release/plans/plan.md` | Established the repo’s release-manifest SSOT, platform-package staging law, and binary-free workspace rule. | Reuse and extend. |
| `openspec/specs/core-binary-asset-boundary/spec.md` | Core publish surfaces must explain every non-JavaScript runtime asset explicitly. | Reuse; compiled CLI binaries are another explicit asset family. |
| `packages/agenter/SPEC.md` | `agenter` currently assumes Bun-first ts-first public entry. | Break and replace. |
| `packages/cli/SPEC.md` | Launcher law belongs to `@agenter/cli`, not to app packages or ad-hoc wrappers. | Reuse. |
| `.github/workflows/release.yml` | Multi-runner artifact collection and npm trusted publishing already exist. | Extend. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| 独立二进制 | Install surface should yield a native executable, not a Bun-required JS bundle. | Standalone compiled Bun executable. |
| agenter只是一个入口 | `agenter` should become a thin distribution shell, not the implementation truth. | Public wrapper package. |
| 以它为最佳实践 | Claude Code’s wrapper-plus-platform-package pattern is the benchmark. | Use the same topology unless repo-specific laws block it. |
| Formula 模板 | Homebrew should be solved with a formula/tap workflow, not an ad-hoc shell script. | Formal Homebrew tap + formula. |
| 真源是 GitHub release binary archives | Binary archives on GitHub Releases own the truth; npm and brew are consumers. | GitHub Release assets are the canonical binaries. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| none yet | No spike created in this round. | N/A |

### Questions To Confirm With User

| Question | Why this is the real question | Current inference before user answers |
| -------- | ----------------------------- | ------------------------------------- |
| Which Marketplace release action should own the GitHub release archive publish step? | The user asked to prefer Marketplace Actions over manual plumbing. | Use `softprops/action-gh-release` unless later testing exposes a blocker. |
| Which Homebrew update action fits a monorepo with an external tap repo? | `Justintime50/homebrew-releaser` exists, but its own docs reject monorepos. | Use `mislav/bump-homebrew-formula-action` against `jixoai/homebrew-agenter`. |

## Intent

### Surface Intent

Keep Bun as the platform, but stop making end users think in terms of Bun. `npm install -g agenter` should fetch a native CLI binary for the host, `agenter` should stay the public command name, GitHub Releases should be the canonical binary source, and Homebrew should offer the same command through a tap/formula flow.

### Underlying Drive

The user wants distribution to stop leaking implementation reality. Bun remains the engine, but package consumers should see a normal native CLI install surface. This is the same law already applied to `@jixo/ghostty-native`: source truth stays in-repo, while platform artifacts are staged and published as explicit atoms. The new clarification is that GitHub release binary archives become the canonical binary truth, and npm/Homebrew become projections from that truth.

### Final Visible Effect

An operator installs `agenter` with npm or Homebrew and immediately gets a working native CLI for their host. Node or Bun may participate during install, but the runtime command path is the compiled Agenter executable itself. Release operators can point to GitHub Release assets as the single binary truth, then show how npm wrapper packages and Homebrew formulae project from those exact archives.

## Platform Diagnosis

- Current platform laws: publishable package truth lives in `scripts/release/release-manifest.ts`; `@agenter/cli` owns launcher law; `agenter` currently assumes Bun-first ts-first source-bin distribution.
- Does this fit as a regular atom: no.
- Does this require law upgrade: yes. `agenter` public package law must shift from source-bin release shell to wrapper-plus-platform-binary distribution shell, and release law must recognize GitHub release archives as the canonical binary source.
- Breaking update stance: preferred. Preserve the `agenter` command surface, but upgrade install/runtime semantics rather than layering compatibility glue on top of the JS bundle path.
- User confirmations still required: none at the architecture level in this round; the remaining work is spec and implementation detail.

## Reverse-Inferred Design

### Interaction / Visual Story

1. User runs `npm install -g agenter` or `brew install agenter`.
2. The install surface selects the current host binary package or archive.
3. `agenter --version` and `agenter ...` execute the compiled Bun binary directly.
4. The operator never has to separately install Bun just to use the published CLI.
5. Release operators can inspect one matrix and know which GitHub release binaries, wrapper metadata, npm projections, and tap metadata are being shipped.

### Interface Shape

- `agenter` remains the public command and public npm package.
- `agenter` becomes a thin Node/npm wrapper shell with:
  - fixed `bin/agenter[.exe]` placeholder path
  - `optionalDependencies` on `@agenter/cli-*` platform packages
  - `postinstall` that links/copies the matching compiled binary into the fixed bin path
  - Node fallback wrapper only for script-disabled installs or troubleshooting
- `@agenter/cli` remains private source authority for launcher/bootstrap logic.
- New public platform packages expose only the compiled executable and host metadata (`os` / `cpu` / `libc`).
- GitHub release archives expose the same compiled executables and become the canonical binary source that npm and Homebrew reference.
- Homebrew formula exposes the same `agenter` command, not a parallel brand or alias.

### Data Shape

- Release manifest remains the durable source for publishable package topology.
- GitHub release asset manifest becomes the durable source for binary archive names, checksums, and platform-to-archive mapping.
- Platform package directories are staged publish surfaces, not code truth.
- Formula metadata is generated from repo-truth release metadata, not maintained as a second handwritten install matrix.
- README install instructions are projection docs, not the install law itself.

### Architecture Shape

- Add a CLI binary matrix parallel to the ghostty matrix, but for compiled Bun executables.
- Release workflow upgrades from “bundle JS + Bun wrapper” to “compile host executables + publish GitHub release archives + project those archives into npm wrapper packages”.
- Homebrew support is another projection over the same binary matrix, not a separate launcher implementation.
- Marketplace actions should own the generic workflow plumbing where they fit:
  - `oven-sh/setup-bun` for Bun setup
  - `softprops/action-gh-release` for GitHub release archive publishing
  - `mislav/bump-homebrew-formula-action` for external tap updates
- Forbidden couplings:
  - no separate handwritten launcher logic inside formula scripts
  - no duplicated platform matrix across GitHub release assets, npm, CI, and Homebrew files
  - no regression where `agenter` runtime path falls back to JS bundle while pretending to be native

### User Confirmation Gates

| Gate | Why confirmation is required | Default until user answers |
| ---- | ---------------------------- | -------------------------- |
| Tap repo bootstrap | The tap repo should be created once and then treated as a projection target. | Bootstrap `jixoai/homebrew-agenter` via `gh` when implementation begins. |

## Intent-Driven Plan

- [ ] 1. Upgrade durable specs for `agenter`, `@agenter/cli`, release law, GitHub release binary truth, and Homebrew projection law.
- [ ] 2. Write BDD tasks for archive production, wrapper package behavior, platform package staging, CI publish flow, brew formula generation, tap bootstrap, and README proof surface.
- [ ] 3. Implement the release pipeline, package topology, and Homebrew projection.
- [ ] 4. Self-review the binary/runtime/tap surfaces against the install story.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should release archive provenance attestation be included in phase 1 or left as a follow-up? | The binary truth is GitHub releases, so provenance is relevant, but the user did not explicitly request it. | Keep attestation optional unless it falls out naturally from existing GitHub Actions support. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep `agenter` as a Bun-required ts-first source bin and only document “please install Bun first”. | Violates the user’s stated distribution goal and leaves implementation detail exposed to operators. |
| Add a custom Homebrew shell script that bootstraps Bun and then installs the existing JS bundle. | Creates a second launcher law and dodges the real binary-distribution problem. |
| Ship one public npm package containing every platform binary. | Inflates installs, weakens platform truth, and ignores the already-proven platform-package law used for ghostty. |
| Use `Justintime50/homebrew-releaser` as the primary Homebrew automation. | Its own Marketplace docs state it is not compatible with monorepos, so it conflicts with this repo shape. |

## Exit Conditions

- Default max review iterations: 2
- Issue recurrence threshold: 2
- Custom exit condition from intent: GitHub release archives exist for every supported target, `npm install -g agenter` and Homebrew install both resolve to those same host-native compiled binaries, and the operator never has to manually manage Bun for normal installation.

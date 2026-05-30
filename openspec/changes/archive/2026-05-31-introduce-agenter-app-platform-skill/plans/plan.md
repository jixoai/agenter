# Intent Document

## Current Round

- Round: 1
- Status: User confirmed public package rename and internal app/app vocabulary migration; ready for apply after OpenSpec update commit.
- Previous plan backup: `plans/plan-v1.md`

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

> 我觉得应该反相过来查找，因社区可能会发布 agenter-ext-xxx 这样的应用，这时候它应该在自己的 peerDeps中声明自己依赖 agenter 。
>
> 我们可以通过这种方式，找到当前agenter对应的 agenter-ext-xxx 的版本。
>
> 这样未来我基于 agenter@1.0.* 发布自己 agenter-ext-xxx@2.0.* 的版本，老用户的agenter@0.0.X 仍然可以正确匹配到老版本的 agenter-ext-xxx@Y

> 同意，所以我们的版本管理思路已经清晰了，还是你觉得有其它盲点？
> 我们可以开openspec vision change，同步记录和讨论。最终我希望你在当前项目中生成一个 skills/create-agenter-app 的skill。是的，我觉得应该把 extension 这个关键词全面升级成 app。agenter现在属于一个dev-platform。我们自己本地的extensions文件夹也应该重命名成 apps

> 同意，另外skill中可以包含一些脚本，我们自己也能用。这个skill即是可以通过社区的 npx skills add 去安装，又可以我们自己项目使用。
> 另外，这些脚本直接使用bun来作为基础，因为agenter的底层是明确依赖bun的。

## Objective Record

### Requirement-Bearing Q&A

| Turn | Speaker | Objective record | Impact on intent |
| ---- | ------- | ---------------- | ---------------- |
| 1 | User | App compatibility should be found in reverse: community apps declare `peerDependencies.agenter`, and Agenter picks an app version compatible with the current host version. | Version lock moves out of Agenter's central table and into app package metadata. |
| 2 | User | Future `agenter@1.0.*` can match a community app's `2.0.*`, while old `agenter@0.0.X` still matches the old app line. | Resolver must reason over host/app compatibility ranges, not equal package versions. |
| 3 | User | Open an OpenSpec vision change to record the discussion. | This change starts as intent/spec work before broad implementation. |
| 4 | User | Generate `skills/create-agenter-app` in the current project. | The repo gains a project-local skill artifact for app creation. |
| 5 | User | Upgrade the keyword `extension` to `app`; Agenter is a dev-platform. | User-facing vocabulary must move from extension-host mental model to app-platform mental model. |
| 6 | User | Rename the local `extensions` folder to `apps`. | Workspace layout must follow the new vocabulary. |
| 7 | User | A skill may include scripts, and those scripts are useful for both community installation and this repo. | The skill should be self-contained and script-backed rather than prose-only. |
| 8 | User | The skill should be installable through community `npx skills add` and usable from the project. | Skill layout must follow standard skill packaging expectations while remaining repo-local. |
| 9 | User | Skill scripts should use Bun because Agenter's base runtime explicitly depends on Bun. | Scaffold/validation scripts should be Bun TypeScript scripts, not Python or npm-neutral shell glue. |

### Evidence Read

| Source | Fact | Why it matters |
| ------ | ---- | -------------- |
| `package.json` | Workspaces currently include `apps/*`, `packages/*`, and `packages/*/*`; release scripts still target `agenter-ext-*`. | The folder rename is a workspace and release pipeline migration, not just a directory move. |
| `pnpm-workspace.yaml` | Workspace discovery still includes `apps/*`. | Both Bun workspace and pnpm/lerna-compatible workspace surfaces must migrate. |
| `packages/app-runtime/src/descriptor.ts` | The current descriptor law is `AppCommandDescriptor` with `appId`, `command`, `packageName`, bin metadata, source policy, and capability hints. | There is already a descriptor atom that can become the app descriptor law instead of inventing a second parallel model. |
| `packages/cli/src/app-command-registry.ts` | First-party commands are hardcoded to `agenter-app-shell` and `agenter-app-studio`. | First-party descriptors exist, but community app version resolution is not yet modeled. |
| `packages/cli/src/app-command-launcher.ts` | Resolution order is local workspace -> installed package -> remote `bunx --package <package> <bin>`. Workspace roots default to `extensions` and `packages`. | The launcher already has the right source planes but needs the `apps` root and compatibility-aware package selection. |
| `openspec/specs/app-command-launcher/spec.md` | Current spec says `agenter shell` resolves to `agenter-app-shell`; local-first uses `apps/shell`; remote fallback runs controlled package names through Bun runner abstraction. | Delta specs must intentionally replace extension naming and root paths rather than leave stale spec truth. |
| `openspec/specs/app-runtime/spec.md` | Current law says core exposes app capabilities without importing app modules and future apps reuse the same app law. | The architectural boundary is good; the vocabulary and ecosystem discovery law are now app-centered. |
| `openspec/specs/runtime-skills-cli-surface/spec.md` | Runtime skills already use progressive discovery and command-backed expansion; scripts can sit behind skill guidance. | `create-agenter-app` should follow progressive disclosure: concise `SKILL.md`, script-backed deterministic scaffolding. |
| `packages/cli/test/app-command-launcher.test.ts` | Existing BDD covers descriptor routing, `shell2` unsupported, local extension root, installed package metadata, remote `bunx`, env propagation. | This gives a direct test seam for `apps/*`, app package compatibility, and descriptor law migration. |
| `packages/app-runtime/test/app-runtime.test.ts` | Existing BDD guards no core import of `agenter-app-shell` / `agenter-app-studio` and keeps app grammar out of core. | Tests should be migrated to the app vocabulary without weakening orthogonality. |
| `find skills ...` | The repository currently has no root `skills/` directory. | `skills/create-agenter-app` is a new project skill distribution surface, not an edit to an existing skill. |

### Git Evidence

| Checkpoint | Expected commit evidence | Current status |
| ---------- | ------------------------ | -------------- |
| OpenSpec artifacts before apply | Commit containing `plans/plan.md`, specs, and `tasks.md` before app-code work starts | Pending. |
| Task-progress commits | Commit containing current-context task checkbox updates plus matching code/BDD evidence | Pending. |
| Self-review updates | Commit containing review output and any reopened or added OpenSpec tasks before the next apply loop | Pending. |
| Normal archive | Commit containing `openspec archive <change>` result | Pending. |
| Abnormal handoff | Commit containing `HANDOFF.md` / `vN.HANDOFF.md` evidence before returning to user discussion | Not needed yet. |

### Existing OpenSpec Survey

| File / change | Existing law or pattern | Reuse, extend, or break |
| ------------- | ----------------------- | ----------------------- |
| `openspec/specs/app-command-launcher/spec.md` | Descriptor-driven first-party command launcher; local-first, installed, remote fallback; launcher-owned daemon env. | Extend and rename toward app-platform language. Break stale `extensions/*` and `agenter-ext-*` after user confirmation. |
| `openspec/specs/app-runtime/spec.md` | Core remains app-agnostic; app descriptor is data; apps bind resources through generic APIs. | Reuse the architecture; replace extension vocabulary with app vocabulary. |
| `openspec/specs/runtime-skills-cli-surface/spec.md` | Skills are progressively discovered and expanded; deterministic command surfaces are preferred for fragile workflows. | Extend with a project-local app-creation skill artifact and Bun script convention. |
| `openspec/changes/move-cli-shell-to-extension-tmux-host` | Earlier move made Shell an extension app and preserved app-extension boundaries. | Supersede the `extension` naming outcome while keeping the app/core isolation principle. |
| `scripts/release/build-bundles.ts` and `scripts/release/publish-bundles.ts` | Release bundles explicitly know `bundle/agenter-app-shell` and `bundle/agenter-app-studio`. | Must migrate with tests; otherwise the new app layout will not release. |

### User Language System

| User phrase | Working meaning | Plain-language translation when needed |
| ----------- | --------------- | -------------------------------------- |
| `反相过来查找` | Compatibility is discovered from app package metadata back toward the host, not from a host-owned lock table outward. | App declares `peerDependencies.agenter`; host filters app versions by that range. |
| `agenter现在属于一个dev-platform` | Agenter is the platform that hosts user/community apps, not merely a CLI plus extensions. | App vocabulary should support third-party app ecosystems. |
| `extension 这个关键词全面升级成 app` | User-facing and repo vocabulary should stop presenting apps as bolt-on extensions. | Rename extension-facing folders/docs/specs/code names unless a narrower internal term is explicitly kept. |
| `本地的extensions文件夹也应该重命名成 apps` | Workspace root must become `apps/`. | Local first-party app source lives under `apps/*`. |
| `skill中可以包含一些脚本，我们自己也能用` | The skill is an executable workflow artifact, not static instructions. | Put Bun scripts under `skills/create-agenter-app/scripts/`. |
| `通过社区的 npx skills add 去安装` | The skill layout must be portable outside this repo. | Keep skill folder self-contained and avoid repo-only assumptions in `SKILL.md`. |
| `脚本直接使用bun来作为基础` | Bun is an accepted required runtime for this skill. | Use `#!/usr/bin/env bun` TypeScript scripts. |

### Demo / Spike Code

| Path | Question it answers | Keep, migrate, or delete |
| ---- | ------------------- | ------------------------ |
| None yet | No spike is needed before specs; existing tests expose the main seams. | N/A |

### Questions Confirmed With User

| Question | Why this is the real question | User decision |
| -------- | ----------------------------- | ------------------------------------- |
| Should public package names move from `agenter-ext-*` to `agenter-app-*` in this change? | `extension` vocabulary includes package names, but renaming published packages affects release, docs, and remote fallback. | Yes. Migrate public packages to `agenter-app-*`; do not preserve compatibility. User will handle unpublish and trusted publishing setup. |
| Should internal `app-*` package/type names also be renamed to `app-*` now? | Existing architecture uses `app` for the platform law. The user explicitly targeted app-platform language, so `app-runtime` would be stale if kept. | Yes. Rename internal `app-*` / `App*` app-platform surfaces in this change. |
| Should Agenter discover arbitrary npm packages automatically or only resolve from catalogs/workspace/installed package roots? | npm has no cheap global reverse peerDependency query; a host needs a search/index surface. | Use package-owned peerDeps for compatibility and a controlled catalog/workspace/installed candidate surface for discovery; no global npm crawl. |

## Intent

### Surface Intent

Create an OpenSpec-backed app-platform migration that replaces the extension mental model with an app mental model, adds compatibility-by-`peerDependencies.agenter`, renames local `extensions/*` to `apps/*`, and ships a reusable `skills/create-agenter-app` skill with Bun scripts.

### Underlying Drive

Agenter has outgrown "extension" as a bolt-on term. Shell and Studio are already ordinary products launched through descriptors, but the ecosystem story still says "extension" in folder names, runtime package names, specs, tests, bundle names, and package identities. The user wants a dev-platform law: apps declare how they attach to Agenter, Agenter resolves compatible app versions by app-owned metadata, and app creation becomes a repeatable skill rather than tribal knowledge.

### Final Visible Effect

An operator or community developer can say "create an Agenter app" and get a clear skill-driven workflow. In the repo, first-party apps live under `apps/*`, command launch still stays descriptor-driven, and release/version resolution no longer depends on a central host lock table. When a host version is known, Agenter can choose compatible app package versions by reading app package `peerDependencies.agenter` and app manifest metadata.

## Platform Diagnosis

- Current platform laws:
  - Core command launcher is descriptor-driven and app-agnostic after lookup.
  - App/app packages own UI grammar and consume daemon/client-sdk/runtime contracts.
  - Local-first resolution already exists across workspace, installed package, and remote runner sources.
  - Runtime skills already support progressive discovery and command-backed workflows.
- Does this fit as a regular atom:
  - The skill itself is a regular atom: `skills/create-agenter-app` can be added as a self-contained project/community artifact.
  - Compatibility filtering is a regular extension of descriptor/package resolution.
- Does this require law upgrade:
  - Yes. "Extension" is a stale ontology. The platform law should become app-centered, and compatibility should be app-declared through `peerDependencies.agenter`.
- Breaking update stance:
  - Breaking cleanup is approved: `apps/*` -> `apps/*`.
  - Public packages move from `agenter-ext-*` to `agenter-app-*`; no compatibility shim.
  - Internal platform surfaces move from `app-runtime` / `App*` to app vocabulary in this change.
- User confirmations still required:
  - None for the current naming and compatibility scope.

## Reverse-Inferred Design

### Interaction / Visual Story

A developer installs or uses the skill, runs the Bun-backed scaffold/check script, chooses an app name and command, and receives a package that declares:

- host compatibility through `peerDependencies.agenter`;
- app command/bin/main export metadata through a manifest or descriptor;
- package keywords/catalog metadata for discovery;
- Bun scripts for build/test/typecheck and app validation.

Agenter then launches apps through the same descriptor law it uses today, but the descriptor source can come from first-party workspace apps, installed apps, or a known app catalog. The host filters candidate versions by `peerDependencies.agenter` before running a package.

### Interface Shape

- App package metadata:
  - `peerDependencies.agenter` is the compatibility contract.
  - App manifest/descriptor owns command, bin, main export, capability hints, and runtime planes.
  - Package keywords or catalog fields make the package discoverable as an Agenter app.
- Host resolver:
  - Reads first-party workspace app descriptors from `apps/*`.
  - Reads installed app package metadata when a package is known or discoverable locally.
  - For remote packages, queries a controlled catalog/index/package name rather than scanning all npm.
  - Filters versions by `peerDependencies.agenter` before selecting the highest compatible version.
- Skill:
  - `skills/create-agenter-app/SKILL.md` contains concise agent-facing workflow.
  - `skills/create-agenter-app/scripts/*.ts` contains Bun executable scaffolding and validation helpers.
  - References or assets are added only if they prevent repeated token-heavy code generation.

### Data Shape

- Durable facts:
  - App package name, app id, command name, bin, main export, capability hints.
  - Host compatibility range declared in app package `peerDependencies.agenter`.
  - App root path or remote package source.
- Projections:
  - "Compatible app version for current Agenter" is a resolver projection from package versions and peer dependency ranges.
  - "Known app catalog" is a discovery projection, not the compatibility authority.
- Must not be confused:
  - The host catalog can suggest candidates, but the app package's `peerDependencies.agenter` is the compatibility authority.
  - App command descriptor is data, not an import of app implementation into core.

### Architecture Shape

- Platform law updates:
  - App descriptor law replaces extension descriptor vocabulary.
  - App resolver law adds compatibility filtering by `peerDependencies.agenter`.
  - Workspace law adds `apps/*` as the local app root.
  - Skill distribution law adds a repo-local, community-installable skill surface.
- Atoms:
  - First-party Shell app.
  - First-party Studio app.
  - `create-agenter-app` skill.
  - Bun scripts inside the skill for scaffold/validate.
- Forbidden couplings:
  - Core must not import Shell/Studio app implementation.
  - Resolver must not infer compatibility from hardcoded host/app version lock tables.
  - Skill scripts must not assume private local paths unless explicitly running in repo mode.

### User Confirmation Gates

| Gate | Why confirmation was required | Decision |
| ---- | ---------------------------- | -------------------------- |
| Public package rename from `agenter-ext-*` to `agenter-app-*` | Impacts npm release identity and remote fallback. | Approved. Rename, no compatibility. User will manage unpublish and trusted publish setup. |
| Internal package/type rename from `app-runtime` to app vocabulary | High blast radius but aligns ontology. | Approved. Rename in this change. |
| Catalog format for community discovery | npm cannot globally reverse-query peer dependencies. | Keep discovery separate from compatibility. Start with controlled catalog/workspace/installed candidates; no global npm crawl. |

## Intent-Driven Plan

- [x] 1. Research and align intent.
- [ ] 2. Write specs from the intent.
- [ ] 3. Write BDD tasks from specs.
- [ ] 4. Implement tasks.
- [ ] 5. Self-review against intent and decide whether to loop.

## Open Questions

| Question | Why it matters | Default assumption until user answers |
| -------- | -------------- | ------------------------------------- |
| Should the first app catalog be a local static registry, package keywords, or npm search abstraction? | PeerDeps solve compatibility, not candidate discovery. | Start with workspace/installed known apps and a controlled catalog abstraction; avoid broad npm search in this iteration. |
| Should the skill script create only an external app package or also support first-party repo mode under `apps/*`? | The user explicitly wants community install and repo use. | Support both modes with a `--repo`/`--workspace` option or auto-detected repo mode. |

## Rejected Paths

| Path | Why rejected |
| ---- | ------------ |
| Keep a central host-owned lock table mapping `agenter` versions to app versions | Contradicts the user's "反相过来查找" compatibility law and blocks community-owned versioning. |
| Scan the whole npm registry for packages with matching peer dependencies | Not technically reliable or cheap; discovery needs a catalog/index/known-name surface separate from compatibility. |
| Add `skills/create-agenter-app` as prose-only docs | The user explicitly wants scripts, and scaffolding is repetitive enough to deserve deterministic Bun code. |
| Rename folders without updating specs/tests/release scripts | Would leave repo truth and platform law inconsistent. |

## Exit Conditions

- Default max review iterations: 3
- Issue recurrence threshold: 3
- Custom exit condition from intent: The change is ready when app-platform vocabulary, compatibility discovery, local `extensions/*` to `apps/*` layout migration, and `skills/create-agenter-app` Bun-script workflow are specified, implemented, tested, and self-reviewed without leaving stale extension terminology in active first-party surfaces except explicitly documented historical compatibility references.

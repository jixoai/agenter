## Context

The repository already has a strong avatar law:

- Avatar is the durable active-session identity.
- Runtime identity is avatar-first.
- The current `Avatars` workbench is a runtime-first operational surface, not a marketplace.
- The platform already distinguishes durable identity from nickname alias, which is a useful precedent for separating avatar identity from avatar source provenance.

The next product step is not to introduce a second avatar ontology. The user clarified that so-called "remote avatars" are still meant to become local, operable avatars after installation. The remote aspect describes how the root-workspace capability bundle is sourced, assembled, or executed, not a permanently separate runtime class that should leak into every surface as `remote` special-casing.

This makes the design cross-cutting:

- WebUI needs a new directory information architecture.
- App/runtime contracts need explicit source/package/install/provenance semantics.
- Durable specs need to preserve the user's exact framing so implementation does not drift.

## Goals / Non-Goals

**Goals:**

- Keep `Avatar` as one local operational identity even when acquisition comes from remote sources.
- Add a durable `source -> package -> install -> local avatar` model instead of `isRemote` branching.
- Preserve `My Avatars` as the default runtime-first operational surface.
- Add `Discover` and `Sources` as explicit peer surfaces inside `Avatars`.
- Make install the default durable flow for remote packages.
- Preserve installed-avatar provenance, including source and revision facts.
- Record the user interview objectively, with verbatim wording preserved where it drives product law.

**Non-Goals:**

- Do not implement the actual remote provider-layer project described by the user as future L1 work.
- Do not make transient direct launch of remote packages the primary user path.
- Do not introduce a second runtime ontology for `remote avatars`.
- Do not finalize update/sync algorithms across multiple sources in this draft.
- Do not implement this change yet; this document only captures the product/spec direction.

## Decisions

### Avatar remains local; remote becomes provenance, not ontology

The primary architectural decision is to keep `Avatar` as the locally operable identity. Remote capability enters through `AvatarSource`, `AvatarPackage`, and `AvatarInstall`, not through a platform-wide `RemoteAvatar` subtype.

Why:

- It matches the user's stated law: installation produces a local durable avatar.
- It keeps runtime, workspace handoff, and settings flows orthogonal.
- It prevents future UI and backend branching from collapsing into `if (isRemoteAvatar)`.

Alternative considered:

- Treat remote avatars as a separate operational class.
  - Rejected because installed avatars are meant to be fully equivalent to local avatars, and the remote aspect only describes sourcing and packaging.

### The Avatars workbench becomes a three-mode directory

The top-level information architecture should be:

- `My Avatars`
- `Discover`
- `Sources`

`My Avatars` remains the default landing surface because the dominant user story is still operating avatars, not browsing supply.

Alternative considered:

- Replace the current avatar workbench with a marketplace-first landing page.
  - Rejected because it would bury the current runtime-first operational value and over-rotate toward acquisition.

### Install is the default durable path

Remote packages may theoretically support temporary launch later, but the primary product path for this change is explicit install:

1. Browse or search remote package
2. Choose install
3. Default nickname to remote name
4. Prompt for rename only when local conflict exists
5. Create local avatar with retained provenance
6. Return to normal `My Avatars` operation

Why:

- It gives durable storage and naming a clear home.
- It keeps workspace/private-slot persistence legible.
- It matches the user's recommendation that temporary direct start is possible but should not be the default path.

Alternative considered:

- Make direct remote start a first-class path from day one.
  - Rejected because durable storage, naming, and follow-up lifecycle become under-specified.

### Installed avatars keep provenance but stay fully equivalent

Installed avatars must retain source/package/revision provenance, but all normal operations treat them as ordinary local avatars.

Implications:

- Provenance is visible as a secondary fact, not a new runtime mode.
- Installed avatars can be pure-local after installation if the package materializes that way.
- Future update logic can key off provenance without affecting day-to-day runtime use.

Alternative considered:

- Show persistent "remote avatar" special chrome in operational views.
  - Rejected because it would fragment the product into mixed ontologies and contradict the user's "theoretical local equivalence" rule.

### Source management is an explicit surface, not hidden setup

The user explicitly wants source entry to be open, not buried. Therefore `Sources` should be a first-class surface in the `Avatars` workbench rather than an admin-only hidden setting.

Why:

- Multiple sources are a product truth, not an implementation detail.
- Alias management matters for conflict resolution and discoverability.
- It keeps supply-plane control available without polluting `My Avatars`.

Alternative considered:

- Hide source management in settings/admin and expose only source labels elsewhere.
  - Rejected because it weakens the user's stated requirement to openly manage sources.

### Names are primary; sources are secondary

Discovery and installed-avatar presentation should follow this identity hierarchy:

- Primary: avatar/package name
- Secondary: source alias such as `scope/repo`

This law should shape list rows, install dialogs, and conflict handling. Source matters, but only after the name establishes the candidate the user is scanning.

Alternative considered:

- Make source the dominant label in mixed-source lists.
  - Rejected because the user explicitly prioritized name first and source second.

### Durable model should explicitly separate source, package, and install

The future durable model should distinguish:

- local avatar identity
- source identity
- remote package identity
- install provenance

Minimum provenance fields should include:

- `sourceId`
- `sourceAlias`
- `packageId`
- `packageName`
- `revision`
- `installedAt`

Alternative considered:

- Store a few optional remote-related strings directly on the avatar row.
  - Rejected because it would become glue state that cannot scale to multiple sources, updates, or provenance-aware UX.

## Risks / Trade-offs

- [Risk] Multi-source conflicts create confusing duplicate names or package identity collisions. → Mitigation: keep names primary in scanning, sources secondary in display, and require explicit rename only at local install conflict boundaries.
- [Risk] Product scope drifts into update/sync mechanics too early. → Mitigation: keep this draft focused on source/discover/install/provenance law; defer richer sync policy.
- [Risk] The workbench becomes too acquisition-heavy and weakens current runtime operations. → Mitigation: keep `My Avatars` as default landing and preserve runtime-first action hierarchy there.
- [Risk] Future implementation shortcuts may still introduce `isRemote` checks. → Mitigation: encode the source/package/install/provenance model in specs before code starts.
- [Risk] Source management as a visible surface could add UI complexity. → Mitigation: treat `Sources` as a supply-plane control view, distinct from `My Avatars` and `Discover`.

## Migration Plan

1. Land durable specs for unified avatar directory, source registry, install flow, and provenance retention.
2. Introduce backend/client data model for source/package/install/provenance without changing current avatar runtime law.
3. Add `Discover` and `Sources` surfaces beside `My Avatars`.
4. Add install flow with default-name and rename-on-conflict behavior.
5. Project provenance into `My Avatars` as a secondary fact once installable sources exist.

Rollback posture:

- Because this change is currently draft-only, rollback means discarding or revising the proposed law before implementation.

## Open Questions

- How should update availability be surfaced once provenance includes revision tracking?
- Should a future direct-launch path exist at all, or remain an advanced/debug-only affordance?
- How much package metadata beyond `name + source` should the first `Discover` list expose by default?
- What trust or verification model should eventually accompany multiple public/private sources?

## Objective Interview Record

The following excerpts are recorded verbatim from the user and intentionally left unnormalized.

### Raw user explanation: local layers and remote essence

> 我这样来解释吧 你现在看到的我们本地的这些，它其实是有好几个部分组成，最核心的部分是 AI call provider，然后第二层是 root workspace，接着第三层是 project Workspace。我一层一层给你分析一下，目前第一层我们在本地是直接做一个 settings 去配置，说这个 Avatar 用的是哪个 provider，第二层，Root workspace, 它提供的是一个沙盒环境，并在这个差额环境里面赋予 AI 能做的一切所需的工具。
>
> 远程模式的核心其实就在第二层，我们未来会推出第一层的能力，这个是我们内部的另外一个项目，但是这跟我现在要讲的第二层这个并不冲突。你可以这么理解，比方说，我想列出一堆技能，在本地模式下，root Workspace 提供的命令行工具可以让 AI 去列出目前所有的技能，并且把这些技能注入到系统提示词里面去。远程模式其实差不多。它的核心原理是，Pace 本质上是挂在一个远程环境里面的，并且它可以做一些屏蔽访问，通过修改它的一个系统提示词来做到只加载必要的一个技能。在这种情况下 只开放第二层意味着模型其实只是在访问远程的一个文件夹而已，但好处是它开箱即用，可以直接获得人家预设好的几百个技能的组合，跟系统提示词的一个配置。想要做到有知识版权的保护，还得从第一层去入手，比方说在第一层里面直接去注入一些技能，把一些细节给屏蔽掉。但这个是刚才讲了，是后边另外一个项目事情，目前第二层它就是一个开放模式。但不论第一层、第二层，它最终体现出来就是一个 远程 Avatar

### Raw user explanation: install, locality, multiple sources, naming priority

> 其实是可以直接启动的，就是一个临时的一个功能，但这有可能会变得更麻烦，因为持久化要放哪里就很不确定，所以我还是建议会有一个明确的安装的过程，这个安装过程可以去给它做重命名，避免和本地的或者其他已经安装的冲突
>
> 理论上都是本地的，所谓的远程只是把本地的一些过程给他远程化了。
>
> 第三个问题和第二个问题其实是类似的，其实我们只是做了一个本地持久化的安装而已，因为我刚才强调过了，我们的核心能力第一层是已经是远程的了，第二层看似在本地，但是它的本质上是作为一个沙盒运行，去做一些 bash 的执行，但这个执行的背后是怎么个原理？是完全自由的。因此它可以本地化，也可以纯远程化，也可以远程加本地的一个混合，而这一切的执行脚本，本质上是发生在本地的，从本地去发起网络请求，然后整理成一个结果，最终打印到沙盒 bash 里面
>
> 理论上是可以同时订阅多个源的，订阅多个源可能会有一些冲突，但是这个属于算法优化的问题，以及界面怎么去优化展示的问题。比如说 我们要对每个源定义别名，方便区分，其实类似 github 的这种命名方式就行  scope/repo 。
>
> 其实最重要的还是靠名字来区分，其次是它的源

### Raw user confirmation: follow-up answers

> 1. 要保留
>
> 2. 默认用远程名 冲突时提示改名
>
> 3. 完全等价，有一些安装下来 甚至就是纯本地的
>
> 4.  建议开放这个源入口
>
> 5. 同意

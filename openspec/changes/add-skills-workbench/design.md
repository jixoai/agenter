## Context

The repository already has two stable facts that this change must respect. First, the runtime skill system is filesystem-backed and keyed by objective skill roots rather than prompt glue. Second, the WebUI's major systems live inside a shared workbench chrome with fixed tabs, fixed-height toolbar chrome, and shared split-detail behavior. A Skills destination therefore should not become a bespoke file explorer, and it should not tunnel through runtime-local shell-only commands just to reconstruct information the platform already owns.

This change is cross-cutting. It touches app-server control planes, client-sdk facades, WebUI shell navigation, the shared workbench tab model, and route-level responsive preview behavior. It also introduces a new preview isolation pattern because pdf/media support is intentionally not the product focus for this round. The second round of this same change corrects the inheritance law so tab order, route defaults, and runtime-visible precedence all converge on the same canonical model.

## Goals / Non-Goals

**Goals:**
- Add `Skills` as a first-class primary WebUI destination that reuses the shared workbench chrome.
- Expose a browser-facing read-only skill browser surface that returns objective skill facts instead of requiring feature code to walk sibling paths from `skill.path`.
- Keep `built-in`, `shared`, and `global` skill browsing centered on one skill per accordion item with a real file tree beneath each skill.
- Make `avatars` a workspace-grouped overview: `Root workspace` comes from the global avatar root, while other groups come only from avatar-private workspace skill roots that actually exist.
- Open one dedicated avatar skill tab per avatar nickname so operators can browse that avatar's skills without leaving the shared Skills workbench.
- Route every file preview through an isolated `filePreviewer` iframe entry, and let `filePreviewer` choose the concrete renderer such as CodeMirror for text-like files or mature libraries for pdf/media.
- Make `shared / built-in / global / avatars` the single canonical inheritance order across runtime precedence, browser page-tabs, and route defaults.
- Cover the feature with BDD-first tests plus desktop/mobile browser walkthrough evidence.

**Non-Goals:**
- Add write/edit/delete skill operations in the WebUI.
- Turn the browser surface into a generic arbitrary filesystem explorer outside bounded skill roots.
- Unify global/shared/avatar skill roots into one merged fake directory tree.
- Invest in custom-designed pdf/media chrome beyond the minimum shared container needed to embed mature preview technology.

## Decisions

### 1. Create a browser-facing read-only skill surface instead of teaching WebUI to infer sibling files

The current runtime skill surface is centered on runtime-local `skill list/search/info/get-config/...` commands and on-disk truth. That is the correct owner for skill facts, but it is the wrong interface for a browser file explorer. The browser workbench needs stable read-only queries that can answer:
- which skills are visible in one root
- which files/directories exist under one skill root
- how one file should be previewed

This surface stays read-only and bounded to objective skill roots. It does not become a generic file read/write API.

Alternatives considered:
- Reuse only `skill list/info` and let WebUI infer directories from `skill.path`. Rejected because it leaks filesystem heuristics into feature code and breaks the “客观文件浏览器” requirement.
- Expose arbitrary file read/write against skill directories. Rejected because it violates the current bounded skill truth law and expands authority far beyond this round's read-only need.

### 2. Keep skill catalog browsing and avatar skill browsing as separate projections over one shared workbench

`shared`, `built-in`, and `global` are all “skill list first” domains. `avatars` is not: it is “avatar list first”, then “workspace group”, then “skill list”, then “file tree”. Trying to flatten those into one generic browser page would either hide the avatar hierarchy or duplicate whole shells.

The workbench therefore uses:
- one fixed catalog tab with `page-tabs = shared/built-in/global/avatars`
- one dynamic tab per avatar nickname for dedicated avatar skill browsing

The dedicated avatar tab reuses the same file tree and detail preview primitives, but not the same top-level `page-tabs`.

Alternatives considered:
- Keep avatar browsing inside the `avatars` page-tab only. Rejected because deep browsing would overload the overview surface and make it harder to preserve list-detail hierarchy on compact layouts.
- Open avatar browsing in a separate route family outside Skills. Rejected because it would break the system-first workbench model and duplicate chrome.

### 3. Define avatar skill truth as workspace-grouped avatar-private roots, not `effectivePath`

For avatar skills, the operator cares about workspace-scoped avatar-private overrides. The correct truth is therefore:
- `Root workspace` group reads the global avatar root `skills`
- each non-root workspace group reads that workspace's avatar-private `skills`
- non-root groups appear only when they contain actual avatar-private skills

We deliberately do not use `effectivePath` to backfill global skills into every workspace group, because that would duplicate the same root into multiple groups and blur the reason each group exists.

Alternatives considered:
- Use avatar `effectivePath` everywhere. Rejected because it hides whether the operator is seeing the global root or a workspace-local override.
- Treat avatar skills as runtime/session-owned instead of avatar/workspace-owned. Rejected because skill roots are durable filesystem facts, not live runtime tabs.

### 4. Make inheritance order a first-class platform law

The catalog order is not a visual preference; it encodes the override model. The platform law for runtime-visible skills is:

1. `shared`: broadest shared agent skills
2. `built-in`: shipped baseline
3. `global`: agenter-global on-disk overrides
4. `avatar-private`: workspace-scoped avatar-private skill roots

The browser catalog therefore mirrors that law as `shared / built-in / global / avatars`, with `avatars` naming the avatar-private address family rather than pretending that all workspace skill truth is one flat root. Default routing must land on `shared`, and legacy `view=avatar` URLs must canonicalize to `view=avatars`.

Alternatives considered:
- Keep `built-in` first because it shipped first. Rejected because visual order would contradict real override precedence and invite regressions in tests and feature assumptions.
- Treat `shared` as equivalent to `built-in`. Rejected because user-maintained shared skills are still an objective on-disk layer and must remain separately inspectable.

### 5. Use an isolated `filePreviewer` entry as the universal preview shell

File preview isolation is the implementation necessity, not only media preview isolation. The correct trade-off for this round is to make the detail pane always embed one bounded preview entry through an iframe. The main workbench remains responsible only for:
- selection
- preview metadata
- iframe URL handoff

The preview entry is free to use mature libraries with minimal house styling, including `pdf.js` for pdf rendering and CodeMirror for text-like source preview. The preview shell therefore stays unified while concrete renderers remain orthogonal.

Alternatives considered:
- Keep text inline in the main route and send only pdf/media through iframe. Rejected because it splits preview lifecycle, duplicates container law, and turns `filePreviewer` into a misnamed special case.
- Render every renderer directly inside the main route tree. Rejected because it couples preview dependencies and cleanup into the main workbench runtime.
- Build a fully custom preview system for visual consistency. Rejected because it disperses focus away from the skill browser itself.

### 6. Keep the client runtime store facade thin and typed

The Skills workbench needs typed browser calls, but it does not need a new giant normalized resource subsystem. The client runtime facade should expose thin read-only methods for listing roots, listing skill trees, and fetching file previews. Route-local state can own selection and expand/collapse projection, while the platform keeps transport authority typed and centralized.

Alternatives considered:
- Add a fully normalized skill browser cache to the runtime store. Rejected for this round because the interaction is read-heavy, route-local, and does not yet need global invalidation semantics.
- Call raw tRPC directly from feature routes. Rejected because it weakens the current layering and type-safe platform facade.

## Risks / Trade-offs

- [Risk] Adding a fifth primary destination changes long-lived navigation law and may regress shell layout or compact rail density.
  Mitigation: update the durable shell specs/docs, reuse existing sidebar primitives, and add route-level browser walkthrough coverage for desktop and iPhone 14.

- [Risk] Browser skill browsing could accidentally drift from real filesystem truth if the read-only API starts synthesizing directories or merging roots.
  Mitigation: keep the browser surface bounded and objective, with explicit root/group metadata and filesystem-derived tree entries.

- [Risk] Dedicated avatar tabs can become a second hidden navigation model if they do not stay inside shared workbench tab law.
  Mitigation: implement them as ordinary workbench tabs keyed by avatar nickname and keep close behavior device-local only.

- [Risk] The isolated preview entry can look visually different from the main app.
  Mitigation: accept minimal visual mismatch for this round and keep the iframe container, metadata, and empty/error states owned by the main workbench so the product shell still feels coherent.

- [Risk] Routing text previews through iframe could regress simple Markdown/source readability or copy semantics.
  Mitigation: make CodeMirror the default text renderer inside `filePreviewer`, keep source-first behavior, and add DOM/browser coverage for `SKILL.md` in addition to pdf.

- [Risk] Pdf preview adds one new dependency and could slow initial build verification.
  Mitigation: isolate the dependency to the preview entry and keep targeted tests/browser checks focused on one pdf happy path plus fallback states.

## Migration Plan

1. Land the OpenSpec artifacts first so the new browser surface and Skills workbench laws are explicit.
2. Add the app-server read-only skill browser queries and client-sdk/runtime-store facades.
3. Add the Skills primary destination, fixed catalog tab, page-tabs, and dedicated avatar tab state.
4. Add the isolated `filePreviewer` entry and integrate detail preview routing so every selected file uses the same iframe-backed preview shell.
5. Add or update BDD tests, Storybook DOM coverage, and route/browser walkthrough scripts.
6. Update durable specs and docs (`SPEC.md`, `DESIGN.md`) before closing the change.

Rollback strategy:
- Revert the change as one unit if the shell or preview behavior regresses. The repository should not stay in a partial state where the shell exposes `Skills` but the browser surface or avatar tabs are missing.

## Open Questions

- None. The remaining implementation choices are tactical rather than architectural.

## Context

`overflow-hidden` currently appears 38 times in `packages/webui`, with the heaviest concentration in `AppRoot`, `WorkspaceShellFrame`, `MasterDetailPage`, `AsyncSurface` consumers, and the major panel shells. Many of these uses are not real clipping requirements; they are compensating for unclear flex ownership and missing dedicated scroll containers. The result is repeated bugs: panels that do not scroll, clipped content in mobile sheets, and regressions whenever a new panel copies an existing shell wrapper.

## Goals / Non-Goals

**Goals:**
- Define explicit overflow roles for layout, scrolling, visual clipping, and animation masking.
- Remove raw layout-level `overflow-hidden` from shell and panel wrappers in `packages/webui`.
- Give each major panel one deliberate primary scroll viewport.
- Keep legitimate visual clipping, such as rounded media frames and accordion masks, but move it behind named primitives.
- Add automated enforcement so future regressions are caught in tests instead of manual review.

**Non-Goals:**
- Redesign panel information architecture or route behavior beyond what is required to fix overflow ownership.
- Change terminal rendering semantics or markdown content semantics outside their clipping containers.
- Apply the contract outside `packages/webui` in this change.

## Decisions

### Overflow roles become explicit primitives
- Add three primitives:
  - `ViewportMask` for the rare application-level viewport clipping case.
  - `ScrollViewport` for any primary scroll container.
  - `ClipSurface` for deliberate visual clipping only.
- Rationale: the current bug pattern comes from one raw class doing three incompatible jobs.
- Alternative rejected: keep raw Tailwind classes and only document preferred usage. That does not create enforceable review boundaries.

### AsyncSurface stops owning clipping
- Keep `AsyncSurface` responsible only for the four async states and loading overlay behavior.
- Replace the current content wrapper contract with an explicit viewport wrapper pattern so callers choose whether they need scrolling.
- Rationale: async-state rendering is orthogonal to clipping and scrolling, and the current abstraction hides too much layout behavior.

### Shell layout owns structure, panels own scrolling
- Refactor `AppRoot`, `WorkspaceShellFrame`, `MasterDetailPage`, and routed panel containers so shell wrappers do not clip descendants by default.
- Each panel defines exactly one main `ScrollViewport`; fixed headers, tabs, and toolbars remain outside it.
- Rationale: clipping should happen at the surface that actually needs it, not at every ancestor.

### Visual clip uses an allowlist
- Keep `overflow-hidden` only in:
  - `ClipSurface`
  - `ViewportMask`
  - `accordion.tsx` animation mask
- Migrate media thumbnails, terminal frames, markdown/code surfaces, and similar cases to the named primitive.
- Rationale: this keeps legitimate clipping while making accidental layout usage obvious.

### Enforcement is source-contract based
- Add a WebUI test that scans source files and fails on raw `overflow-hidden` outside the approved primitive files.
- Add Storybook DOM regressions for long-content shells and panels to ensure the main viewport still scrolls in real DOM.
- Rationale: the problem is structural and needs static enforcement plus behavioral verification.

## Risks / Trade-offs

- [Risk] Removing shell clipping exposes existing sizing bugs in panel content. → Mitigation: convert each major panel to one primary `ScrollViewport` and verify with Storybook DOM plus browser walkthroughs.
- [Risk] Over-correcting could remove needed rounded-corner clipping for media and terminal frames. → Mitigation: keep a dedicated `ClipSurface` primitive and audit all current visual uses explicitly.
- [Risk] AsyncSurface API changes may touch many panels. → Mitigation: keep the API adjustment narrow and migrate all current callers in the same change.
- [Risk] Static allowlist tests may feel strict during active UI work. → Mitigation: keep the allowlist tiny and documented so exceptions require an intentional primitive update instead of ad hoc class usage.

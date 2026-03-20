## 1. OpenSpec and overflow contract

- [x] 1.1 Capture the overflow audit proposal, design, and delta specs for layout, async surface, and shell navigation behavior
- [x] 1.2 Inventory current `overflow-hidden` usage in `packages/webui` and classify each occurrence as layout, scroll, clip, or animation mask

## 2. Shared primitives and async surface

- [x] 2.1 Add shared overflow primitives for viewport masking, primary scroll viewports, and visual clipping
- [x] 2.2 Refactor `AsyncSurface` so it no longer owns clipping and callers opt into explicit viewport behavior
- [x] 2.3 Update AGENTS best practices with the stricter overflow contract and approved exceptions

## 3. Shell and panel migration

- [x] 3.1 Refactor `AppRoot`, `WorkspaceShellFrame`, and `MasterDetailPage` to remove layout-level raw `overflow-hidden`
- [x] 3.2 Migrate workspace and devtools panels to one primary scroll viewport per surface
- [x] 3.3 Migrate legitimate visual clipping cases such as markdown/code, media, and terminal chrome to the clipping primitive

## 4. Enforcement and verification

- [x] 4.1 Add a source-contract test that blocks unauthorized raw `overflow-hidden` usage in `packages/webui`
- [x] 4.2 Update Storybook DOM coverage for long-content shells and panels to verify real scrolling behavior
- [x] 4.3 Run focused unit, Storybook, and browser walkthrough verification and fix regressions until the change is ready

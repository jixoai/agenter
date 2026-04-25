## 1. Contracts

- [x] 1.1 Record the terminal split-detail migration in proposal, design, and delta spec artifacts.
- [x] 1.2 Add or update terminal layout regression coverage so the surface no longer depends on `SplitView`.

## 2. Terminal Surface

- [x] 2.1 Migrate `terminal-system-surface` from `SplitView` to `WorkbenchSplitDetail` with desktop ratio persistence.
- [x] 2.2 Preserve compact terminal access by routing the detail rail through the shared right-sheet fallback instead of a terminal-only stacked layout.

## 3. Verification

- [x] 3.1 Run targeted WebUI unit and Storybook DOM tests for terminal surface layout behavior.
- [x] 3.2 Run a real browser walkthrough on the terminal route in desktop and mobile viewports to confirm the new split-detail behavior.

## 4. Toolbar And Surface Refinement

- [x] 4.1 Update proposal, design, and delta spec acceptance criteria for terminal page-toolbar ownership, neutral outer body chrome, an actions-only detail rail plus toolbar-opened users dialog, and the shared actor selector contract.
- [x] 4.2 Extract a shared avatar-bearing actor selector primitive and migrate terminal seat pickers plus the message-room viewer chooser to it.
- [x] 4.3 Inject terminal-local toolbar content through `WorkbenchPageToolbar`, keep the right rail focused on full-height `Actions`, open terminal users management from toolbar actions, and remove the local detail tabs from the right rail.
- [x] 4.4 Neutralize the terminal workbench outer body chrome so the route uses `fill` ownership without the oversized rounded card shell.

## 5. Verification

- [x] 5.1 Update terminal/messages source contracts and Storybook DOM coverage for the new toolbar ownership and actor selector behavior.
- [x] 5.2 Run targeted WebUI verification plus a real desktop/mobile browser walkthrough on `http://127.0.0.1:4173/terminals/chess-dev2` for the refined terminal page, confirming the full-height actions rail and the toolbar-opened users dialog.

## 6. Refinement Follow-up

- [x] 6.1 Keep terminal explanatory copy inside `HelpHint`, fix the shared help-hint layering contract so compact shell chrome cannot occlude the popup, and narrow the terminal help copy for mobile readability.
- [x] 6.2 Replace the terminal-only action preview wrapper with the same structured tool invocation viewer stack used by Heartbeat, and lock the behavior with targeted Storybook DOM coverage.
- [x] 6.3 Extend the shared actor selector primitive with density + chrome variants so message toolbars can stay compact/borderless while terminal seat pickers keep the detailed bordered field treatment.
- [x] 6.4 Re-run targeted tests plus a fresh desktop/mobile browser walkthrough against a verified preview, confirming the neutral shell, help-hint overlay, unified structured preview path, and selector treatment.

## 7. Composer And Action-Rail Refinement

- [x] 7.1 Rebuild the bottom `TerminalActionsPanel` around shared `InputGroup` layouts so write and read both live inside the stage pane body, with read parameters living in the upper panel and compact single-line actor selection plus inline submit actions owning the bottom row.
- [x] 7.2 Keep the Heartbeat-shared structured invocation viewer in the terminal `Actions` rail, but force plain/static structured-value rendering there so the narrow rail does not expose an extra viewer-mode menu.
- [x] 7.3 Re-verify the refined terminal route through focused layout/source tests, Storybook Chromium DOM coverage, and `@agenter/webui build`, confirming compact-sheet fallback, read parameter placement, and shared actor selector menu subtitles.
- [x] 7.4 Refine terminal page-toolbar semantics so `Actions` is the stateful current-detail toggle while `Users` remains a plain dialog action, and verify the compact-sheet path still opens from the toolbar.

## 8. Runtime Status Follow-up

- [x] 8.1 Update proposal, design, and delta spec acceptance criteria so terminal page-toolbar status reflects authoritative runtime facts, while PTY lifecycle buttons stay deferred until shared backend/client APIs exist.
- [x] 8.2 Render terminal `running/stopped` and `busy/idle` facts inside the page-toolbar `status` slot, and cover the behavior with focused source plus Storybook DOM regression.

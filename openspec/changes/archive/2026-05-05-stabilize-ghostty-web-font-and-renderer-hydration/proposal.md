## Why

`ghostty-web` is now the desktop-default terminal renderer, but two renderer-facing gaps still break the operator experience: canvas font metrics can settle against a fallback font before the intended mono font finishes loading, and switching from `xterm` to `ghostty-web` can leave the viewport blank until later PTY output arrives. At the same time, `wterm` should remain available for experimentation, but it should no longer be presented as a peer-stable renderer in the first-line UI.

## What Changes

- Stabilize `ghostty-web` font settlement around browser font loading so terminal metrics remeasure after the configured mono face becomes available instead of keeping fallback-width spacing.
- Treat `ghostty-web` font changes as renderer-local live updates rather than forcing a full renderer rebuild when the engine can remeasure and repaint in place.
- Add one renderer-local post-hydration refresh path so a rebuilt `ghostty-web` session paints the current snapshot immediately instead of waiting for future PTY output.
- Replace the default terminal font baseline with a compact literal system-mono stack at `14px` with `lineHeight: 1`, while keeping explicit optional terminal font overrides available.
- Mark `wterm` as experimental in the terminal config UI and lower its visual priority relative to `auto`, `ghostty-web`, and `xterm`.
- Add targeted renderer adapter, `terminal-view`, Storybook, and route-level regression coverage for font settlement and renderer switching.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `terminal-renderer-adapter`: Renderer adapters now distinguish live font settlement support, and `ghostty-web` must refresh its visible surface after font-load and snapshot-hydration events.
- `terminal-font-profile`: The shared terminal font baseline now stays compact and renderer-neutral, while adapters keep ownership of renderer-specific font settling and capability gaps.
- `terminal-view-component`: Renderer rebuild and snapshot hydration must not leave `ghostty-web` blank, even when the snapshot sequence has not advanced.
- `webui-terminal-surface`: Terminal config UI now marks `wterm` as experimental and presents stable renderers first.

## Impact

- `packages/terminal-view/src/renderers/ghostty-web-renderer-adapter.ts`
- `packages/terminal-view/src/terminal-renderer-profile.ts`
- `packages/terminal-view/src/terminal-view-element.ts`
- `packages/terminal-view/test/terminal-renderer-adapters.test.ts`
- `packages/terminal-view/test/terminal-view-element.test.ts`
- `packages/webui/src/lib/features/terminals/terminal-window-surface.svelte`
- `packages/webui/src/lib/features/terminals/terminal-system-surface.stories.ts`
- `packages/webui/tests/e2e/system-surfaces.e2e.ts`
- `openspec/specs/terminal-renderer-adapter/spec.md`
- `openspec/specs/terminal-font-profile/spec.md`
- `openspec/specs/terminal-view-component/spec.md`
- `openspec/specs/webui-terminal-surface/spec.md`

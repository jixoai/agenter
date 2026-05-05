## Why

当前 terminal-window 的几何法则、titlebar chrome、fit/cover 投影和 resize 交错在一起，已经导致多轮回归：cover 无限放大、resize 吸到最小尺寸、titlebar 被混入多余状态与错误控件语义。现在需要把 window-container / safe-area / terminal-content 的关系收口成一套稳定契约，并把 titlebar 收敛为最小可操作原型。

## What Changes

- Stabilize the terminal window projection contract around `window-container`, `safe-area`, `terminal-content`, and host-owned titlebar chrome.
- Refine `fit` and `cover` into explicit window-shell modes:
  - `fit` scales only terminal content, never the titlebar chrome.
  - `cover` keeps terminal content at native scale, removes the window frame, pins the titlebar to the top, and lets the outer viewport scroll.
- Reduce titlebar chrome to two macOS-style state circles:
  - lifecycle group: blue `bootstrap` or red `kill`
  - mode group: yellow `fit` or green `cover`
- Reduce titlebar inline-end metadata to size information only.
- Keep terminal deletion as a separate destructive action outside the titlebar control primitive.
- Add focused geometry, Storybook DOM, and E2E coverage for projection mode behavior and live resize behavior.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `terminal-system-surface`: The terminal window projection, titlebar chrome, and live resize requirements change to follow the stabilized fit/cover window contract.

## Impact

- `packages/webui/src/lib/features/terminals/terminal-window-surface.svelte`
- `packages/webui/src/lib/features/terminals/terminal-system-surface.svelte`
- `packages/webui/src/lib/features/terminals/terminal-page-toolbar-content.svelte`
- `packages/webui/src/lib/features/terminals/terminal-geometry.ts`
- `packages/webui/src/lib/features/terminals/terminal-geometry.spec.ts`
- `packages/webui/src/lib/features/terminals/terminal-system-surface.stories.ts`
- `packages/webui/test/storybook/terminal-system-surface.stories.test.ts`
- `packages/webui/tests/e2e/system-surfaces.e2e.ts`
- `openspec/specs/terminal-system-surface/spec.md`

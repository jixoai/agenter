## Why

Current cli-shell work still drifts between several rendering truths: native host-local composition, Web-only projection shortcuts, backend terminal truth, and ad-hoc scrollbar/selection/cursor state. That drift keeps recreating the same failures: native/Web mismatch, cursor offset, flicker, scrollbar desync, incomplete dialogue behavior, and a `--web` mode that is not useful as an automated acceptance surface.

This change rebuilds the durable terminal projection law around one final product screen: `terminal-2`. Native Ghostty and `--web` must render the same final cli-shell product surface, while shell, dialogue, scrollbar, focus, selection, wrapping, and copy semantics remain owned by their backend/offscreen renderers instead of by frontend patches.

### User Objective Anchors

The following user statements are copied verbatim as acceptance anchors for this change. They are not informal background; they constrain the implementation.

> `--web模式在网页上看到的效果和非web模式必须是完全一样的。之前要做--web模式，目的就是为了方便你在前端做测试。因为Ghostty.app这样的应用的可访问性几乎没有，导致你很难做测试。这点你一直是偏离的，所以你现在做的--web模式，等于没做。所以接下来我希望你好好做，当然我还是可以直接帮你在Ghostty.app上进行人工测试。但未来只要稳定了，我希望你能用--web模式，稳固e2e测试`

> `terminal-chat本来就不用原生的PTY的srollback。因为它本身也是用Opentui开发，用的是Opentui 的scrollBox来渲染对话内容`

> `你把 terminal-1 shell screen 和  scrollbar / focus / selection projection 分开了，这不允许，因为二者合并起来，才是我一直在强调的使用Opentui开发的“离屏渲染器”，如果你分开，最终你的架构绝对会再次出问题。`

> `离屏渲染器是可以配置隐藏滚动条的。这个功能很适合用在 terminal-chat 这里。`

> `我的目的不是为了开进城，而是为了能独立选择和复制`

> `你的方案才是复杂的，因为你要自己搞算法，我让你独立backend就是为了方便你复用代码，同时也是为了让我们的离屏渲染器打磨得更好。只有先稳定了，再考虑用无backend的方案。`

## What Changes

- Introduce an explicit `terminal-screen-projection-law` capability that defines the two transport/rendering laws:
  - Protocol 1: raw terminal transport for targets that understand terminal control bytes.
  - Protocol 2: backend-interpreted screen projection for targets that render backend-authored cells/frames.
- Define `terminal-2` as the final cli-shell product screen truth for both native and Web hosts. **BREAKING**
- Require `cli-shell --web` to render the same final product screen as native cli-shell, not a shell-only or debugging-only subset. **BREAKING**
- Require the shell offscreen renderer to output shell cells together with shell scrollbar, focus, selection, cursor, and wrapping state as one cell-locked render product. These concerns MUST NOT be split into external compositor decorations. **BREAKING**
- Require `terminal-chat` to be an independent OpenTUI dialogue/offscreen backend in the first implementation, using the same offscreen renderer/event-bridge law as shell surfaces and OpenTUI scrollBox semantics rather than PTY scrollback. **BREAKING**
- Prohibit the first implementation from replacing terminal-chat backend ownership with hand-rolled dialogue selection/copy/wrap algorithms; a no-backend or lighter in-process optimization may only be considered after the backend-based path is stable and accepted. **BREAKING**
- Allow offscreen renderers to configure visual chrome such as scrollbar visibility while preserving backend scroll, viewport, cursor, selection, wrapping, and copy truth.
- Define the native host and Web host as equivalent adapters over `terminal-2`:
  - native: encode `terminal-2` final screen to raw output on the current process stdout for Ghostty or another real terminal program.
  - Web: encode or stream `terminal-2` final screen to the browser terminal renderer used by `--web`.
- Require `--web` to become the primary stable automated E2E surface once the product screen is stable, while Ghostty remains the authoritative native manual acceptance environment.
- Remove implementation paths that keep accepted product chrome, dialogue state, shell selection, shell scrollbar, or cursor truth only in host-local overlays outside backend/offscreen render truth. **BREAKING**

## Capabilities

### New Capabilities

- `terminal-screen-projection-law`: Defines raw transport, backend screen projection, offscreen renderer responsibilities, final product screen composition, and native/Web host equivalence.

### Modified Capabilities

- `cli-shell-product`: Clarifies terminal-1, terminal-chat, and terminal-2 roles; requires `--web` and native to render the same final product surface; requires terminal-chat to use OpenTUI dialogue backend semantics rather than PTY scrollback.
- `terminal-view-component`: Clarifies `shell-terminal-view` and `web-terminal-view` as host adapters over the same final product screen, not separate product truths.
- `terminal-pty-transport`: Clarifies where raw PTY bytes are still lawful and where raw output is only an adapter for a backend-authored final product screen.
- `runtime-terminal-contract`: Clarifies terminal-2 publication, geometry, frame truth, and observation boundaries for composed product screens without promoting host-local projection caches to runtime truth.

## Impact

- `packages/cli-shell/src/tui/*`
- `packages/cli-shell/src/web/*`
- `packages/cli-shell/test/*`
- `packages/terminal-system/src/*`
- `packages/terminal-transport-protocol/*`
- `packages/terminal-view/*`
- `packages/termless-core/*`
- `openspec/specs/cli-shell-product/spec.md`
- `openspec/specs/terminal-view-component/spec.md`
- `openspec/specs/terminal-pty-transport/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- new `openspec/specs/terminal-screen-projection-law/spec.md`
- `.chat/rebuild-cli-shell-terminal-projection-law/*` acceptance notes and native/Web comparison evidence

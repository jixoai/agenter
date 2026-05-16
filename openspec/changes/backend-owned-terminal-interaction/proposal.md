## Why

Native cli-shell acceptance exposed a repeated architecture failure: selection, copy, cursor-follow, word navigation, and scroll-linked selection were implemented as OpenTUI-layer simulations instead of backend-owned terminal interaction truth. That created a second local truth, so fixes kept regressing under real Ghostty-native behavior: selected ranges stayed on screen while content scrolled, cursor-follow did not reliably return to the backend cursor, and double/triple-click behavior diverged from terminal semantics.

The repair must move terminal interaction ownership into backend/offscreen-renderer contracts. The user's stated goal is not to open extra processes for their own sake; the goal is to get independent selection, copy, scroll, cursor, and wrap behavior with one reusable backend interaction law. If a backend already owns that behavior, the projection layer must reuse it. If a backend does not yet expose it, the missing behavior belongs in a backend interaction adapter, not in host-local OpenTUI rendering code.

## What Changes

- Add a durable `terminal-backend-interaction` capability for backend-owned selection, copy, semantic selection, cursor-follow, and interaction overlay publication. **BREAKING**
- Require terminal backend adapters, including `ghostty-native`, to expose explicit interaction capability facts and backend-owned selection APIs when the underlying backend supports them. **BREAKING**
- Require projection hosts to route pointer, drag, wheel, copy, paste, resize, keyboard, and semantic click events to the owning backend/offscreen renderer rather than keeping host-local selection truth. **BREAKING**
- Require OpenTUI/native projection components to render backend-provided cells, cursor, selection overlays, and scrollbars as projections only; they MUST NOT own scrollback selection truth for a backend terminal. **BREAKING**
- Require backend-owned selection overlays to move with backend viewport/scrollback truth, including after shell output, wheel scroll, scrollbar drag, and viewport target changes. **BREAKING**
- Require double-click and triple-click clustering to stay strict: same owner, same backend row, x drift at most one terminal cell, and y drift must stay on the same terminal row. **BREAKING**
- Require semantic word selection and Option+Left/Right word navigation to share the same backend-aware word-boundary helper; frontend-only ASCII-space splitting is forbidden. **BREAKING**
- Require copy to read selected text from the owning backend/offscreen renderer and deliver it through the host clipboard adapter, such as OSC 52 in native shell projection.
- Require dialogue/terminal-chat to use the same backend interaction bridge as shell projection before any no-backend optimization; terminal-2 or host adapters MUST NOT hand-roll dialogue selection/copy/scroll/cursor/wrap algorithms.
- Add targeted debug trace filters for interaction ownership so `--debug=selection,follow,key,scroll` can prove which layer received and owned an event.
- Preserve the existing raw/projection transport split and the existing backend viewport mutation law; this change does not promote Ghostty-native to default and does not redefine terminal-2 composition.

## Capabilities

### New Capabilities

- `terminal-backend-interaction`: Backend-owned terminal interaction semantics for selection, copy, semantic selection, cursor-follow, backend overlays, and event routing.

### Modified Capabilities

- `terminal-screen-projection-law`: Move offscreen selection/copy/cursor-follow ownership from projection-local simulation to backend/offscreen-renderer interaction truth.
- `terminal-view-component`: Clarify that `shell-terminal-view` and `web-terminal-view` may capture events but must render backend-owned interaction overlays and must not create a second selection truth.
- `cli-shell-interaction-capabilities`: Replace product-local backend workaround recommendations with backend capability-driven interaction routing and enhancement decisions.
- `terminal-pty-transport`: Add semantic interaction event transport/control-plane requirements for selection, copy, cursor-follow, and backend-owned overlay publication.
- `runtime-terminal-contract`: Require runtime terminal publications and frame payloads to carry backend-owned interaction state when a product projection needs to render it.

## Impact

- `openspec/specs/terminal-backend-interaction/spec.md`
- `openspec/specs/terminal-screen-projection-law/spec.md`
- `openspec/specs/terminal-view-component/spec.md`
- `openspec/specs/cli-shell-interaction-capabilities/spec.md`
- `openspec/specs/terminal-pty-transport/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `packages/ghostty-native/src/*`
- `packages/ghostty-native/native/src/*`
- `packages/termless-core/src/*`
- `packages/terminal-system/src/*`
- `packages/terminal-transport-protocol/src/*`
- `packages/terminal-transport-protocol/proto/*`
- `packages/cli-shell/src/tui/*`
- `packages/cli-shell/test/*`
- `.chat/backend-owned-terminal-interaction/*`

## 1. Durable Presentation Profile

- [x] 1.1 Extend terminal-system profile, patch, clone, merge, and config-view paths with durable `font` metadata and defaults.
- [x] 1.2 Expand the browser-authenticated global terminal config mutation path to `rendererPreference`, `theme`, `cursor`, and `font`, while keeping AI-facing runtime terminal mutation read-only for those fields.
- [x] 1.3 Sync app-server and client-sdk terminal projections so `font` and the expanded presentation profile survive refresh, mutation, and live catalog updates.

## 2. Renderer Stack Adapters

- [x] 2.1 Add a shared terminal font resolver and default terminal font profile in `@agenter/terminal-view`.
- [x] 2.2 Update `xterm` and `ghostty-web` adapters to consume shared `theme + cursor + font` mapping instead of hard-coded font values.
- [x] 2.3 Add a real `wterm` renderer stack adapter using `@wterm/dom` plus `@wterm/ghostty`, and register it in the renderer registry without host-local special cases.

## 3. WebUI Terminal Chrome

- [x] 3.1 Extend `terminal-view-host` and terminal viewport props to pass durable font data into `terminal-view`.
- [x] 3.2 Add the titlebar config icon button and panel for `theme`, `font family`, `font size`, and `rendererPreference`.
- [x] 3.3 Wire the titlebar config panel to authenticated terminal config mutation and keep fit/cover titlebar content aligned with the existing sticky cover-titlebar law.

## 4. Verification And Durable Docs

- [x] 4.1 Add or update terminal-view unit tests for shared font mapping and renderer-stack behavior, including the `wterm` path.
- [x] 4.2 Add terminal surface Storybook DOM coverage for the titlebar config panel and live presentation updates.
- [x] 4.3 Update durable specs and code comments with the `ghostty-web` default rationale, the `wterm(core + dom host)` stack law, and the durable `font` ownership rule.
- [x] 4.4 Run targeted typecheck and test commands for terminal-view and webui, and fix any regressions required to keep the change shippable.

## 5. Presentation Mutation Protocol Hardening

- [x] 5.1 Update OpenSpec design/spec/tasks so context loss still preserves the dialog draft/apply flow, adapter-owned presentation mutation policy, and renderer-settled ready ack.
- [x] 5.2 Replace the titlebar config dropdown with one dialog that stages local presentation drafts and commits only on Apply.
- [x] 5.3 Add adapter-owned presentation mutation policy plus `terminal-view-presentation-ready` dispatch so renderer settlement is an explicit fact.
- [x] 5.4 Update terminal-view unit tests and terminal surface Storybook DOM tests for dialog behavior, mutation policy, and ready-ack flow.

## 6. Renderer Geometry And Font Settlement Hardening

- [x] 6.1 Switch terminal-window fit/cover projection to renderer-measured native content metrics, and remove host-side reverse projection of renderer metrics.
- [x] 6.2 Normalize `wterm` to viewport-only host chrome so default standalone padding/shadow/radius do not leak into integrated terminal-window layout.
- [x] 6.3 Ensure renderer rebuild always rehydrates the current snapshot into the fresh local session, even when snapshot sequence has not advanced.
- [x] 6.4 Replace default terminal font stacks that depend on WebUI-only CSS variables with renderer-safe literal stacks, and keep font-family options compatible with JS-option renderers.
- [x] 6.5 Add focused terminal-view unit tests for renderer-native metrics, rebuilt-session visibility, and adapter font application behavior across `xterm`, `ghostty-web`, and `wterm`.
- [x] 6.6 Run targeted `@agenter/terminal-view` and terminal WebUI geometry tests, then fix any regressions needed to keep all three renderer paths shippable.

## 7. Native Metrics Settlement And Real Renderer Verification

- [x] 7.1 Update OpenSpec design/spec notes so renderer-native content metrics, not renderer host boxes, remain the geometry truth across `xterm`, `ghostty-web`, and `wterm`.
- [x] 7.2 Fix the `wterm` adapter to measure the active terminal content surface instead of prioritizing the outer scroll host box, and remove any stale reverse-projection logic from `terminal-view`.
- [x] 7.3 Make the terminal config font-family options materially distinct so renderer/font changes are visually auditable instead of presenting near-identical fallback stacks.
- [x] 7.4 Add regression coverage for renderer-native metric settlement and renderer config changes, then rerun the real terminal route checks serially.

## 1. OpenSpec And Durable Law

- [x] 1.1 Add delta specs for renderer adapter, font profile, terminal-view, and WebUI terminal surface covering ghostty-web font settlement, rebuilt-session repaint, and experimental wterm labeling
- [x] 1.2 Keep the design rationale explicit about why desktop still prefers `ghostty-web` and why `wterm` remains experimental

## 2. Ghostty-web Renderer Stabilization

- [x] 2.1 Update the shared terminal font default and ghostty-web adapter so browser-loaded mono fonts settle through adapter-local remeasure and repaint
- [x] 2.2 Change ghostty-web font mutation policy to `live-apply` and ensure rebuilt or rehydrated sessions repaint the current snapshot immediately

## 3. WebUI Projection

- [x] 3.1 Mark `wterm` as experimental in the terminal config dialog and keep stable renderer options visually primary

## 4. Verification

- [x] 4.1 Add terminal-view and renderer-adapter regressions for ghostty-web font settlement and xterm-to-ghostty snapshot repaint
- [x] 4.2 Update Storybook and route-level checks for the experimental wterm label and terminal renderer switching flow
- [x] 4.3 Run targeted terminal-view and WebUI verification commands

## 5. Browser Font Readiness Follow-up

- [x] 5.1 Replace the webfont-first default terminal baseline with a compact system-mono default shared by terminal-system, client-sdk, terminal-view, and WebUI fixtures
- [x] 5.2 Promote browser font readiness into shared renderer helpers and wire both `ghostty-web` and `xterm` through explicit settle paths
- [x] 5.3 Capture the lazy-webfont evidence in OpenSpec and durable specs so future refactors do not regress on `@font-face` vs loaded-font truth

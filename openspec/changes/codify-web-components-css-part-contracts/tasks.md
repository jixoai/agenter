## 1. Durable spec

- [x] 1.1 Add a package-level durable spec for `@agenter/web-components` describing css-part-based styling contracts for Lit atoms.
- [x] 1.2 Add an OpenSpec delta describing the HelpHint styling contract and host-reflected state.

## 2. HelpHint css-part contract

- [x] 2.1 Expose stable HelpHint part names for trigger and popup surfaces.
- [x] 2.2 Reflect HelpHint presentation state onto the host so outer clients can theme `::part(...)` selectors by factual state.
- [x] 2.3 Keep fallback internal styles, but move the richer WebUI HelpHint skin to outer `::part(...)` rules.

## 3. Shared Lit atom rollout

- [x] 3.1 Expose stable top-level `css-part` slots on `adaptive-icon-button`, `async-surface`, `json-viewer`, `markdown-document`, and `tool-invocation-card`.
- [x] 3.2 Reflect the minimum factual host state needed for outer `::part(...)` theming on those atoms.

## 4. Verification

- [x] 4.1 Add regression tests for the expanded Lit atom part/state exposure.
- [x] 4.2 Run targeted `web-components` and WebUI verification.

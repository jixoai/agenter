## 1. Durable spec

- [ ] 1.1 Add a package-level durable spec for `@agenter/web-components` describing css-part-based styling contracts for Lit atoms.
- [ ] 1.2 Add an OpenSpec delta describing the HelpHint styling contract and host-reflected state.

## 2. HelpHint css-part contract

- [ ] 2.1 Expose stable HelpHint part names for trigger and popup surfaces.
- [ ] 2.2 Reflect HelpHint presentation state onto the host so outer clients can theme `::part(...)` selectors by factual state.
- [ ] 2.3 Keep fallback internal styles, but move the richer WebUI HelpHint skin to outer `::part(...)` rules.

## 3. Verification

- [ ] 3.1 Add regression tests for HelpHint part/state exposure.
- [ ] 3.2 Run targeted `web-components` and WebUI verification.

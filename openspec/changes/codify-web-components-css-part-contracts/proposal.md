## Why

`@agenter/web-components` is the durable UI atom layer for multiple clients. The current Lit migration of `help-hint` keeps visual styling mostly private inside shadow DOM, which regressed the WebUI theme and removed a stable customization contract for downstream clients.

This is not just a `help-hint` bug. It exposes a platform-law gap: Lit components need a first-class styling contract that stays orthogonal to product skins. The follow-up rollout therefore covers the high-value durable atoms that already define visible internal surfaces: `help-hint`, `adaptive-icon-button`, `async-surface`, `json-viewer`, `markdown-document`, and `tool-invocation-card`.

## What Changes

- Codify a package-level rule that styled Lit atoms must expose stable `css-part` slots for their visual surfaces.
- Reflect HelpHint presentation state onto the host so outer clients can theme `::part(...)` surfaces based on factual state.
- Re-theme the Svelte WebUI HelpHint through `::part(trigger)` / `::part(popup)` instead of relying on shadow-private styles.
- Expose stable top-level `css-part` surfaces and host-reflected state on the other high-value Lit atoms that currently keep their skin private.
- Add regression tests covering HelpHint part exposure and host state reflection.

## Impact

- Restores the intended HelpHint appearance in the Svelte WebUI.
- Gives future Lit atoms a durable extensibility rule instead of ad hoc shadow CSS overrides.
- Keeps `@agenter/web-components` reusable across clients while preserving product-specific theming authority outside the atom package.

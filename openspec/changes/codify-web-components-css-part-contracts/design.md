## Context

`@agenter/web-components` owns framework-agnostic UI atoms implemented with Lit. Those atoms should carry structure and minimal fallback styling, but product clients such as the Svelte WebUI need a stable way to apply their own skin without forking component internals.

The current `help-hint` implementation violates that separation because:

- trigger/popup styling is mostly hidden inside shadow DOM
- the host does not expose stable `part` names
- the host does not reflect presentation state needed for stateful `::part(...)` styling

## Goals

- Make HelpHint externally themeable without reopening shadow internals.
- Establish a durable rule for future Lit atoms in `@agenter/web-components`.
- Keep fallback styles inside the component so standalone usage still works.

## Non-Goals

- Rebuild HelpHint behavior or persistence semantics.
- Move all styling responsibility out of the component package.
- Introduce a second tooltip/help primitive.

## Decisions

### Lit atoms expose stable visual slots through `css-part`

Any Lit component with internal visual surfaces must publish stable `part` names for those surfaces. Product clients can then style them through `::part(...)` or Tailwind part selectors without depending on internal class names.

### Stateful theming uses host-reflected facts

If a component needs stateful external theming, the host must reflect the relevant factual state through host attributes. Internal state on shadow children is insufficient because `::part(...)` cannot query shadow-private selectors.

For HelpHint, the host reflects the presentation mode so WebUI can theme:

- default/closed
- passive auto-open
- active open

### HelpHint keeps fallback styles, WebUI owns the product skin

The Lit element keeps minimal fallback styles so it remains legible in isolation. The Svelte WebUI applies the richer product theme through `::part(trigger)` and `::part(popup)`.

## Risks / Trade-offs

- Stable part names become public contract and require discipline for future refactors.
- Reflecting host state adds a small amount of DOM surface area, but it is necessary for durable theming.

## Verification Plan

1. Add a regression test covering HelpHint part names and host state reflection.
2. Run `pnpm --filter @agenter/web-components test`.
3. Run `pnpm --filter @agenter/webui typecheck`.
4. Run `pnpm --filter @agenter/webui test:unit`.
5. Run `pnpm --filter @agenter/webui test:dom`.

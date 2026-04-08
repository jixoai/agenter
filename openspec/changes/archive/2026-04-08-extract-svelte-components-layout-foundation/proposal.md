## Why

The current scaffold-family law is implemented, but it still lives inside `@agenter/webui`, while `ScrollView` lives in the old `@agenter/svelte-primitives` package. That splits one structural platform law across two packages and prevents other Svelte consumers such as `@agenter/web-chat-view` from reusing the same shell contract without reaching back into product-local WebUI source.

This is a package-boundary problem, not a page bug.

- Shared Svelte structural primitives should not live in the product package that consumes them.
- Lit durable atoms in `@agenter/web-components` should not absorb Svelte-only layout law.
- `@agenter/web-chat-view` needs the same scroll + shell law, but must not depend on `@agenter/webui`.

## What Changes

- Replace `@agenter/svelte-primitives` with a new shared package: `@agenter/svelte-components`
- Move `ScrollView` plus scaffold-family primitives into that shared Svelte package
- Update `@agenter/webui` and `@agenter/web-chat-view` to consume `@agenter/svelte-components`
- Remove duplicated scaffold-family implementation from `@agenter/webui`
- Preserve `@agenter/web-components` as Lit-only durable atoms, with no Svelte structural primitives mixed in

## Capabilities

### Modified Capabilities

- `svelte-webui-platform`
- `scrollview-surface`
- `web-chat-view`
- `web-components-styling`

### Added Capabilities

- `svelte-components-platform`

## Impact

- `packages/svelte-components`
- `packages/webui`
- `packages/web-chat-view`
- `openspec/specs/*`

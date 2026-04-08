## Context

The repository now has a durable Svelte layout law:

- `ScrollView` owns scrolling
- scaffold-family primitives own stretch/shrink regions
- internal `data-layout-role` hooks prevent slot-level overrides from breaking the layout contract

But the implementation is split incorrectly:

- `ScrollView` still belongs to the legacy `@agenter/svelte-primitives`
- scaffold-family primitives still live in `@agenter/webui`
- `@agenter/web-chat-view` cannot reuse the full law without depending on product-local source

## Goals / Non-Goals

**Goals**

- Establish one shared Svelte package for durable structural primitives
- Keep Lit web-components and Svelte structural primitives orthogonal
- Let `web-chat-view` reuse shared layout law directly
- Remove duplicated scaffold-family source from `webui`

**Non-Goals**

- Rebuild `web-chat-view` into a full product shell
- Move shadcn-svelte product components into the new shared package
- Reopen Lit/web-component packaging for layout primitives

## Decisions

### Create `@agenter/svelte-components` as the shared Svelte structural layer

The new package owns:

- `ScrollView`
- `Scaffold`
- `DialogScaffold`
- `SplitView`

These primitives remain Svelte-only and are exported together as one structural platform surface.

### Remove `@agenter/svelte-primitives` instead of keeping a compatibility package

The repository will directly replace the old package instead of retaining a parallel compatibility layer. Workspace consumers will update imports in the same change.

### Keep `@agenter/web-components` Lit-only

`@agenter/web-components` continues to own framework-agnostic custom elements and `css-part` styling contracts. It does not absorb Svelte layout primitives, because that would mix Shadow DOM atoms with Svelte structural shells and corrupt both package boundaries.

### `DialogScaffold` excludes UI-framework-specific close affordances

The shared package exports `DialogScaffold.Root/Header/ScrollBody/Footer` only. A close button belongs to the consuming UI framework or product shell, not to the structural primitive itself.

### `web-chat-view` reuses shared shell law, not only shared scrolling

`web-chat-view` will continue to own chat-specific transcript/message/composer behavior, but its transcript shell will compose shared Svelte structural primitives instead of maintaining a private page-shell law.

## Risks / Trade-offs

- [Risk] Direct replacement touches multiple packages at once. -> Mitigation: keep the shared API small and run consumer regressions in the same change.
- [Risk] `web-chat-view` could accidentally inherit product-specific shell assumptions. -> Mitigation: only move structural law; leave chat-specific visuals and transport logic inside `web-chat-view`.
- [Risk] Shared package could start absorbing product-level UI atoms. -> Mitigation: add package SPEC and delta specs that freeze the boundary.

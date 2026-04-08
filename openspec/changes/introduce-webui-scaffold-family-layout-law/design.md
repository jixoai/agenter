## Context

The current WebUI already codifies two useful laws:

- `ScrollView` is the single scroll primitive
- raw overflow and `min-h-0` patches are disallowed in feature code

That is necessary but not sufficient. The real regression source is the missing layer between route intent and scroll ownership. Every page still decides for itself how to create a stretchable region, so `ScrollView` arrives too late and layout mistakes recur.

## Goals / Non-Goals

**Goals**

- Move fixed-vs-stretch layout ownership out of feature code and into shared primitives
- Give AI and humans a canonical, low-decision way to build page shells and dialogs
- Reduce layout review from class soup inspection to primitive usage verification
- Keep the implementation native to Web and Svelte, not a simulated mobile layout runtime

**Non-Goals**

- Replace CSS Grid/Flex with a custom runtime layout engine
- Introduce a fully generic UI DSL for arbitrary layout trees
- Solve every compact-navigation state machine in the first primitive release

## Decisions

### Use scaffold-family semantics, not a generic flex DSL

The layout layer will use a small number of high-signal primitives with cross-platform names:

- `Scaffold`
- `DialogScaffold`
- `SplitView`

This keeps the API close to SwiftUI / Flutter / Compose shared mental models while still mapping cleanly onto Web `grid/flex`.

### Keep `ScrollView` as the only scroll owner

The new layout primitives do not replace `ScrollView`. Instead, they define the stretch region where `ScrollView` is allowed to live. `ScrollView` remains the only shared owner of actual scrolling.

### Official shadcn-svelte primitives win over local fallbacks

When a canonical `shadcn-svelte` primitive already exists in the repository, feature code should consume that primitive directly instead of routing through a local fallback. `NativeSelect` remains allowed only for genuine native form behavior; route surfaces and management panels should use the official `Select` composition.

### Let `PanelShell` become a compatibility surface, not the final law

`PanelShell` will be rebuilt on `Scaffold.Root` so existing surfaces immediately inherit the new law. During migration, feature code may still use `PanelShell`, but new layout-critical work should target the scaffold-family primitives directly.

### Enforce layout law with two layers

`oxlint` can help on script-level rules such as import restrictions and primitive usage boundaries, but it cannot fully govern Svelte template layout structure on its own. The repository will therefore use:

- `oxlint` for script-level constraints where possible
- source-contract tests for `.svelte` template-level layout rules

As of April 4, 2026, the practical ceiling is still script-level lint only: official `oxlint` JS plugins do not support custom file formats/parsers such as `.svelte`, so template/layout ownership remains a source-contract responsibility rather than a plugin responsibility.

### Compact behavior stays explicit and incremental

`SplitView` v1 will standardize common desktop split shells and remove repeated page scaffolding. Compact navigation behaviors that rely on `Sheet`, `Tabs`, or `Dialog` remain explicit at the feature level until the shell law has stabilized.

### Compact split shells must release viewport height when detail content is secondary

The `sidebar-content-detail` family is not allowed to keep mobile layouts permanently viewport-locked when that causes the trailing detail surface to disappear from the document flow. In compact mode, height ownership must allow the detail panel to remain reachable and scrollable even after the primary stage grows.

## Risks / Trade-offs

- [Risk] New primitives add another abstraction layer. -> Mitigation: keep the family small, use cross-platform naming, and provide stories as the single usage reference.
- [Risk] Over-constraining `SplitView` too early can block legitimate layouts. -> Mitigation: start with a small set of durable variants that match existing major surfaces.
- [Risk] `oxlint` may give a false sense of safety for `.svelte` template layout. -> Mitigation: treat it as complementary to contract tests, not a replacement.

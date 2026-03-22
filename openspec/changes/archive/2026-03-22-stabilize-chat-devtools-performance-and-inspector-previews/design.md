## Context

The current WebUI already has selector-level equality and memoized `MarkdownDocument`, but Chat and Devtools still rebuild too much work at the route boundary. Chat reprojects transcript rows into fresh objects, which defeats memoized row subtrees and recreates read-only `CodeMirror` instances more often than necessary. Devtools keeps broad subscriptions alive for every tab, so entering the route pulls hot terminal, LoopBus, model, and cycle slices even when only one tab is visible.

Cycle facts add a second problem: large structured payloads are rendered through Markdown/CodeMirror even though they are not free-form documents. That raises initial mount cost and hurts readability for high-cardinality data such as attention item lists. The async-surface primitive also models four states in type form but still lacks the intended empty-loading copy treatment.

## Goals / Non-Goals

**Goals:**
- Keep Chat and Devtools mounted without recreating heavy read-only markdown surfaces on unrelated runtime updates.
- Restrict Devtools subscriptions and model-stream retention to the active tab.
- Replace structured Markdown dumps in Cycle facts with a lightweight YAML-first viewer that still preserves raw JSON access.
- Make empty-loading vs ready-loading behavior explicit in shared async surfaces.
- Add regression coverage around selector isolation, chat row stability, async-surface states, and YAML-first fact rendering.

**Non-Goals:**
- Replace `MarkdownDocument` with a different markdown renderer.
- Redesign backend session/runtime protocols.
- Rework terminal rendering or model/LoopBus feature scope beyond subscription ownership.

## Decisions

### Route subscriptions move to tab-owned subtrees
`WorkspaceDevtoolsRouteView` will keep only route chrome subscriptions and delegate each tab's heavy selectors to a tab-specific subtree. `retainApiCallStream` also moves out of `AppRoot` and becomes model-tab-owned.

Why: inactive tabs should not subscribe to hot session data or keep model HTTP streams retained.

Alternative considered:
- Keep one large route component and add more equality helpers. Rejected because the route would still subscribe to all hot slices at once.

### Chat projection keeps stable row identities
The conversation projector will still compute the same transcript semantics, but unchanged rows will reuse prior row/message objects so memoized row components can preserve mounted `CodeMirror` instances. Large-string row signatures in the viewport will be replaced with smaller structure keys tied to row order and count.

Why: the main regression is not markdown correctness; it is avoidable React remount churn.

Alternative considered:
- Replace read-only markdown with a custom renderer. Rejected by requirement and unnecessary if row identity is fixed.

### Structured inspection content gets a dedicated lightweight viewer
Structured Devtools facts will render through a dedicated `JSONViewer` that serializes once, defaults to highlighted YAML, and exposes per-view + global render modes from a menu. It will use simple text/highlight rendering instead of `CodeMirror`.

Why: structured facts are data previews, not editable/markdown documents.

Alternative considered:
- Reuse `ToolStructuredView` everywhere. Rejected because the user explicitly wants YAML/JSON modes and raw JSON fallback.

### Async surface empty-loading becomes explicit copy, not recycled empty state
`AsyncSurface` will gain a dedicated empty-loading label path while ready-loading keeps the small overlay chip.

Why: first-load panels need a restrained but explicit loading treatment when there is no data yet.

## Risks / Trade-offs

- [Memo boundaries can hide stale props] -> Stabilize handlers and use explicit prop comparators only on pure presentational subtrees.
- [Selector narrowing can accidentally drop refresh behavior] -> Keep route chrome subscriptions minimal but verify each tab still refreshes while active.
- [Lightweight syntax highlighting can drift from strict parsers] -> Limit the viewer to preview readability and preserve raw JSON mode as the exact fallback.
- [Fact previews may become too verbose] -> Default to YAML preview but keep the menu-local override for raw JSON and formatted JSON.

## Migration Plan

1. Add the new OpenSpec delta and lightweight viewer component.
2. Refactor Chat projection/row rendering to preserve stable row identities.
3. Split Devtools into tab-owned subscription subtrees and move API stream retention to the model tab.
4. Apply the structured viewer and async-surface contract in Cycle inspection.
5. Run targeted unit and Storybook DOM tests before marking tasks done.

## Open Questions

- None for this iteration; the user explicitly rejected markdown-renderer replacement and requested menu-only mode controls.

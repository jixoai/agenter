## Context

Two separate issues are really the same architectural smell:

1. Heartbeat footer context is still a local widget with its own trigger/open/render rules instead of a shared ai-elements composition.
2. Bottom-anchored virtual conversations still rely on best-effort scrolling after DOM changes, so measured size growth can move the viewport away from the latest rows.

Both problems mean the rule lives in the consuming surface rather than in the shared primitive.

## Goals / Non-Goals

**Goals**

- Make ai-elements Context a reusable Svelte primitive with a stable trigger/content contract.
- Let Heartbeat reuse that primitive directly instead of rendering a special local footer badge block.
- Make bottom-anchor preservation part of the shared scroll/virtualization law.
- Reset visible context usage when the newest call is a compact cycle.
- Keep type and variant ownership orthogonal so leaf components do not import public types from sibling component implementations.

**Non-Goals**

- Rework Heartbeat group projection or compact-card grouping in this change.
- Replace every legacy dropdown or popover in the repo with HoverCard.
- Introduce a generalized scroll manager for every surface beyond the bottom-stick law needed by virtual conversations.

## Decisions

### Model Context as a shared local-state primitive, not a footer-specific badge

`Context.svelte` will own a `ContextClass` instance and expose it through Svelte context. Trigger, header, footer, and usage rows read that shared state instead of reading a Heartbeat-specific store.

This keeps the primitive reusable:

- Heartbeat passes usage/model/max-token facts in
- ai-elements subcomponents render the shared trigger/content contract
- future Svelte consumers can reuse the same composition without depending on Heartbeat selectors

Alternative considered:

- Keep the old `context-state.svelte.ts` dropdown-driven store and just restyle the footer.
  - Rejected because the user explicitly asked for the real ai-elements Context contract, and the old design was still route-local state dressed as a generic component.

### Use HoverCard + Progress as primitive dependencies

The requested Context demo is a passive usage disclosure rather than a command menu. `HoverCard` is therefore the right primitive, and Progress/inline token rows become reusable leaf components.

Alternative considered:

- Keep DropdownMenu and manually emulate passive hover/open behavior.
  - Rejected because it mixes command semantics with disclosure semantics and keeps the component off the ai-elements contract.

### Extend ScrollView with virtual-size and item-size-adjust hooks

The durable fix for bottom-anchor drift is to let consumers react to virtual size changes and to let bottom-anchored surfaces opt into `shouldAdjustScrollPositionOnItemSizeChange`.

`VirtualConversation` will wrap those hooks and enforce:

- appended latest rows keep bottom anchor when the viewport was already pinned
- last-row growth keeps bottom anchor after remeasurement settles
- programmatic bottom scrolls do not flip the stick-to-bottom context into "user scrolled away"

Alternative considered:

- Keep adding more route-local `requestAnimationFrame(scrollToBottom)` retries in Heartbeat.
  - Rejected because the same failure would reappear in every virtual conversation surface.

### Compact resets visible context usage

When the newest call is `kind === "compact"`, Heartbeat footer context becomes `unavailable` instead of reusing the prior call's usage. Compact is a prompt-window boundary, so showing pre-compact usage as the current context is objectively wrong.

Alternative considered:

- Keep showing the last non-compact usage until a later normal call arrives.
  - Rejected because it hides the compact boundary and makes the footer look like the post-compact prompt window already consumed those tokens.

### Extract public types and variant helpers from component implementation files

`message.types.ts`, `tool.types.ts`, and `*.variants.ts` files will hold exported contracts that were previously trapped inside Svelte component modules.

Alternative considered:

- Continue exporting public types from `.svelte` implementation files.
  - Rejected because it couples consumers to component module layout and makes reuse harder as the primitives expand.

## Risks / Trade-offs

- [Risk] HoverCard timing may differ from the old explicit menu toggle. -> Mitigation: keep the consumer API simple and allow delays through props.
- [Risk] Bottom-anchor guard frames could mask genuine user scrolls if held too long. -> Mitigation: keep the guard short and only arm it around deliberate programmatic bottom-scroll operations.
- [Risk] Compact-reset context may look like a regression if operators expected stale usage to remain visible. -> Mitigation: treat compact as a first-class boundary in the selector contract and keep the trigger visibly disabled rather than blank.

## Migration Plan

1. Publish shared HoverCard/Progress primitives and extracted variant/type helpers.
2. Refactor ai-elements Context to the shared context-based composition.
3. Update Heartbeat footer selectors/rendering to consume the new Context primitive and reset across compact boundaries.
4. Extend ScrollView and VirtualConversation with bottom-anchor size-change hooks.
5. Add regression tests for compact-reset context and shrinkable Heartbeat stage layout.

Rollback strategy:

- The primitive changes are additive. If HoverCard presentation regresses, Heartbeat can temporarily render the trigger disabled while keeping the shared context contract.
- If bottom-anchor logic regresses, the new ScrollView callbacks can be disabled while leaving the rest of the virtual scroll API intact.

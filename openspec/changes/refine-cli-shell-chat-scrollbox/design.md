## Context

The current cli-shell Chat implementation has a useful app shape but the wrong scroll physics. ChatTUI v9 proved the desired effect: a compact shell-first app with an optional Chat panel, an independent Chat scrollbar, bottom-pinned follow behavior, and a return-to-bottom affordance when the user scrolls up. The implementation then encoded that effect with a app-local row offset, `dialogueScrollOffset`, and a self-painted scrollbar.

That model is brittle because it collapses three layers into one variable:

1. durable MessageRoom truth
2. the Chat view's loaded message window
3. the native host's viewport position and scrollbar behavior

OpenTUI already provides `ScrollBoxRenderable` with `scrollTop`, `scrollHeight`, `viewport`, `scrollBy`, `scrollTo`, `stickyScroll`, `stickyStart`, and built-in vertical scrollbar support. OpenTUI also provides `ScrollBarRenderable` as a controlled progress primitive. MessageRoom already exposes snapshots and page reads through `pageGlobalRoomMessages({ chatId, before, limit })`. The app should compose those laws instead of inventing another scroll system.

## Goals / Non-Goals

**Goals:**

- Make native cli-shell Chat use OpenTUI scroll container semantics for the message-list viewport.
- Remove `dialogueScrollOffset` as a durable app law.
- Load older room messages incrementally as the user scrolls near the older-history edge.
- Preserve the user's visible anchor when older messages are prepended.
- Preserve bottom-pinned follow behavior for new messages and streaming updates.
- Keep the Chat scrollbar independent from the shell-terminal viewport scrollbar.
- Keep MessageRoom as the only durable transcript truth.

**Non-Goals:**

- Do not redesign terminal-1 / terminal-2 app truth.
- Do not change TerminalSystem viewport ownership for the shell surface.
- Do not couple WebUI to cli-shell.
- Do not introduce a cli-shell-local transcript database or message truth.
- Do not preserve backward compatibility for `dialogueScrollOffset` as a public model field.

## Layered Model

### 1. MessageRoom truth

MessageRoom owns durable message history, message ids, timestamps, sender identity, recall state, attachment metadata, snapshots, page reads, and incremental updates.

Cli-shell may cache a loaded window for rendering, but that cache is only a projection over MessageRoom truth. It cannot become a second transcript store.

### 2. Chat loaded window

Cli-shell's Chat view owns only ephemeral window state:

- loaded message ids and rendered block keys
- `nextBefore`
- `hasMoreBefore`
- `loadingBefore`
- pinned-to-bottom status
- pending new-message count or marker while unpinned
- prepend anchor identity and measured row position

This is view state, not durable message truth and not terminal viewport truth.

### 3. Native host scroll container

The native Chat body should be a real OpenTUI `ScrollBoxRenderable` or a thin wrapper around it. The ScrollBox owns viewport movement, wheel direction, keyboard/page scrolling, content height, and scrollbar rendering. App code should react to semantic edges and anchors; it should not manually draw scrollbar glyphs as the accepted interaction truth.

The app may use a controlled OpenTUI scrollbar wrapper where backend or host control projection requires it. The important law is that the accepted Chat scroll control comes from OpenTUI primitives, not from ad-hoc text painting.

## Scroll Direction

Native wheel direction must match user expectation:

- wheel down moves the Chat viewport toward newer/lower content
- wheel up moves the Chat viewport toward older/upper content

The implementation should test this against the ScrollBox-facing API rather than only testing `dialogueScrollOffset` arithmetic. If OpenTUI reports deltas in host-specific shapes, cli-shell normalizes them once at the host adapter boundary.

## Incremental Loading

The initial Chat panel should render a recent snapshot/page. When the user scrolls near the top edge and `hasMoreBefore` is true, cli-shell requests older messages through the existing message page contract:

```ts
pageGlobalRoomMessages({ chatId, before: nextBefore, limit })
```

The returned older messages are prepended into the loaded window. `nextBefore` and `hasMoreBefore` update from the page response. Duplicate message ids are ignored so snapshot, page, and incremental transport events can converge safely.

The threshold should be expressed in rows or viewport-relative units, but it remains a host/view trigger. It is not a new MessageRoom concept.

## Anchor Preservation

Before prepending older messages, cli-shell records the first stable visible message/block anchor and its visual row within the ScrollBox viewport. After the older messages render, cli-shell restores the ScrollBox position so that the same anchor remains at the same visual row.

If the exact anchor cannot be materialized, cli-shell may fall back to preserving the prior distance from the top of the rendered content. That fallback should be observable in tests, but it must not become the normal path.

## Bottom Pinning

When Chat is pinned to bottom:

- new messages and streaming updates follow the latest content
- successful user send clears the draft and returns to bottom-pinned mode
- opening Chat initially starts at bottom unless a future explicit restore contract says otherwise

When the user scrolls upward:

- Chat becomes unpinned
- new messages do not steal the viewport
- cli-shell exposes the existing compact return-to-bottom/new-message affordance
- activating that affordance uses ScrollBox scroll-to-bottom behavior and returns to pinned mode

OpenTUI `stickyScroll` / `stickyStart: "bottom"` may be used where it matches this behavior, but cli-shell still needs explicit pinned/unpinned state for app affordances.

## App And Platform Boundary

This is a cli-shell app correction over existing platform laws. It does not add cli-shell branches to MessageRoom, TerminalSystem, WebUI, or terminal-view components.

The durable law is:

- MessageRoom provides history and pagination.
- OpenTUI provides native viewport primitives.
- Cli-shell composes them into one Chat panel for the current app room.

Terminal-2 app truth remains the final visible terminal surface law from the existing cli-shell changes. This change only repairs the Chat transcript chrome's own scroll ownership and loading behavior.

## Migration Notes

`dialogueScrollOffset` should be removed from the final model, or demoted to a temporary private adapter during migration. It must not remain in specs, tests, or public model shape as "distance from bottom" scroll truth.

Self-painted Chat scrollbar code should be deleted or reduced to non-interactive debug/fixture rendering. If any text-grid projection remains for snapshots, it must be a projection of the OpenTUI/ScrollBox state, not the accepted source of interaction truth.

## Risks / Trade-offs

- [Risk] OpenTUI ScrollBox may not expose every edge fact directly. -> Mitigation: wrap it once in a cli-shell Chat scroll adapter that reads `scrollTop`, `scrollHeight`, and viewport height and emits semantic edge facts.
- [Risk] Anchor preservation can be flaky if rendered block heights change after Markdown wrapping. -> Mitigation: anchor by message/block id after layout and test prepend stabilization with wrapped multi-line messages.
- [Risk] Incremental loading can duplicate messages when snapshot and page overlap. -> Mitigation: merge by durable message id and preserve stable order.
- [Risk] The older self-painted frame tests may assert exact glyph rows. -> Mitigation: rewrite them as BDD behavior tests around scroll direction, edge loading, anchor preservation, and pinned behavior.

## Open Questions

- Should the initial Chat page size stay aligned with the existing snapshot default, or should cli-shell define a smaller native Chat page size to keep TUI startup cheap?
- Should the return-to-bottom affordance show only a compact icon/count, or should the current `↓ N` style remain the accepted app text?

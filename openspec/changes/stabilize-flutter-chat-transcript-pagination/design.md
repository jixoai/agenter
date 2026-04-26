## Context

The package already models reverse paging through canonical `page` client actions and `page` server events. The controller exposes `requestOlderPage`, and transcript entries include `ChatLoadOlderEntry` when `hasMoreBefore` is true. The missing law is scroll ownership: the transcript viewport needs to decide when to anchor to latest and when to ask the controller for older rows.

This belongs in `FlutterChatView` / transcript stage, not the host product shell. Profile routing, room inspector, and Apple sheet chrome should not know how transcript pagination works.

## Goals / Non-Goals

**Goals:**

- Open non-empty transcripts at the newest visible edge.
- Keep auto-follow for incoming messages only while near latest.
- Auto-request older pages when the operator scrolls near the top.
- Avoid repeated page requests while a page is already loading.
- Preserve the visible anchor after older messages are merged.

**Non-Goals:**

- Do not change the canonical websocket protocol.
- Do not reverse the durable message order in controller state.
- Do not remove the visible load-older row; it remains a fallback and loading indicator.
- Do not add native platform-specific scroll APIs.

## Decisions

### Decision 1: Controller remains transport law; viewport owns scroll law

`ChatViewController.requestOlderPage` remains the sole way to emit a `page` action. `FlutterChatView` observes scroll position and calls that controller method when the top edge threshold is reached.

### Decision 2: Initial bottom anchoring is one-shot per controller

When a transcript first becomes non-empty for a mounted view, the viewport jumps to `maxScrollExtent` after layout. After that point, user scroll intent controls the viewport. New messages only auto-follow when distance to latest is within the existing auto-follow threshold.

### Decision 3: Older-page anchor is preserved by max extent delta

Before requesting older history, the view stores the current `maxScrollExtent`. After the page merges and layout updates, it adds the max-extent delta to the current offset. This keeps the currently visible message roughly stable while older content appears above it.

## Risks / Trade-offs

- [Risk] Very short transcripts can trigger an older-page request immediately because the top and bottom edges coincide. Mitigation: only auto-page after the initial bottom anchor has completed and the scrollable has content dimensions.
- [Risk] Repeated scroll notifications can spam page requests. Mitigation: gate on `state.loadingMore` and a local pending anchor.
- [Risk] Anchor preservation depends on post-frame layout. Mitigation: update with `addPostFrameCallback` and clamp to current extents.

## Migration Plan

1. Add transcript scroll thresholds and pending pagination anchor state in `FlutterChatView`.
2. Jump to latest after the first non-empty transcript layout.
3. Trigger `requestOlderPage` from top-edge scroll observation.
4. Preserve anchor after page merge.
5. Add widget tests for initial bottom anchor and auto page request.
6. Sync specs and validate.

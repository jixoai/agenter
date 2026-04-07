## Context

The workbench tab strip already uses a horizontal `ScrollView`, but the chrome wrapper itself still sizes to the tab content on compact viewports. That breaks the shell law: horizontal overflow should belong to the local tab scroller, not to `document.body`.

This is a shared chrome containment bug, not a room-specific chat bug.

## Goals / Non-Goals

**Goals:**

- Keep the workbench chrome width pinned to the available viewport width.
- Preserve local horizontal scrolling for tabs on compact devices.
- Verify the fix on the real `Messages > Room` mobile path.

**Non-Goals:**

- Redesigning tab visuals or tab density again.
- Changing room transcript layout or composer behavior.
- Reworking desktop workbench sizing.

## Decisions

### 1. Constrain the chrome container before the scroller

The outer workbench tab-strip wrapper must be width-constrained and clip local overflow so the internal `ScrollView` owns the horizontal scroll.

### 2. Preserve local tab scrolling semantics

The tab content can remain wider than the viewport, but that width must stay inside the scroll viewport instead of participating in page sizing.

### 3. Verify with structural evidence

Success is not just visual. The mobile walkthrough should show `document.scrollingElement.scrollWidth === clientWidth` while the tab strip still renders all tabs through local horizontal scrolling.

## Risks / Trade-offs

- [Risk] Over-constraining the chrome wrapper could clip tabs without scroll access. → Mitigation: keep the internal horizontal `ScrollView` unchanged and only constrain ancestors.
- [Risk] Shared tab-strip changes could affect other workbenches. → Mitigation: limit the fix to containment classes and verify the Messages room path first.

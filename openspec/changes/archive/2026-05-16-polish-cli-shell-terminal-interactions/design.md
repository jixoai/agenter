## Context

The archived terminal projection law established the right ownership boundary:

```txt
terminal-1 shell truth
  -> shell offscreen renderer, including scrollbar/focus/selection/cursor/wrap
terminal-chat backend
  -> dialogue offscreen renderer, including selection/copy/scroll/cursor/wrap
terminal-2
  -> final composed product screen
native/web host
  -> adapter only
```

The next polish work must stay inside that boundary. The failures being addressed are interaction gaps, not a reason to add a second product truth or a second terminal-2-local selection model.

## Goals / Non-Goals

**Goals:**

- Make shell keyboard input follow the cursor back into the visible viewport when the user has scrolled away.
- Implement double-click word selection using `Intl.Segmenter(undefined, { granularity: "word" })` rather than whitespace splitting.
- Implement triple-click row selection.
- Keep word/row selection bounded to the current selection owner region, so shell and dialogue selections do not bleed into each other.
- Make shell scrollbar progress visible and backend-driven.
- Cover the behavior with BDD tests and keep the native manual checklist/report updated for later user walkthrough.

**Non-Goals:**

- Do not add a new terminal backend process for this polish.
- Do not move selection, copy, cursor, or scrollbar truth into terminal-2 compositor code.
- Do not implement image paste or richer media routing in this change.
- Do not change the transport pacing law except where a test proves shell input must call the existing follow-cursor bridge.

## Decisions

### 1. Selection Gestures Live In The Offscreen Frame Projection Component

`BackendFrameRenderable` already owns bounded text selection and copy extraction for projected cells. It is the right place to add double-click and triple-click gesture interpretation.

Rejected alternative: implement double-click/triple-click in `CliShellCoreApp`.

Reason: that would put selection math beside terminal-2 hit-testing and create another selection truth outside the projection component.

### 2. Word Boundaries Use ICU Segmentation

Double-click word selection SHALL use `Intl.Segmenter(undefined, { granularity: "word" })` and accept only `isWordLike` segments. The char index must be derived from terminal cell columns using the same terminal-width measurement as rendering.

Rejected alternative: split by spaces or ASCII punctuation.

Reason: terminal content contains CJK, emoji, shell prompts, paths, and symbols. Whitespace splitting is not a terminal-quality word selection algorithm.

### 3. Triple-Click Selects The Bounded Row

Triple-click selection selects the clicked row inside the active owner region. The selected columns are the row's actual rendered text span inside that region, not the entire terminal-2 screen.

Rejected alternative: select the whole composed screen row.

Reason: shell and dialogue have independent selection/copy ownership. A row gesture inside one region must not select product chrome or another region.

### 4. Shell Input Uses Existing Follow-Cursor Bridge

`LiveTerminalMirror.followCursor()` already knows how to target the backend viewport based on backend cursor truth. The keyboard input path must call it after successful shell input send, just like paste already does.

Rejected alternative: locally set viewport in the frontend before sending input.

Reason: viewport truth belongs to the backend. The frontend can request follow-cursor, but it must not create a local viewport override.

### 5. Scrollbar Progress Is A Backend-Driven Projection

`BackendScrollbarRenderable` already receives backend `scrollSize`, `viewportSize`, and `scrollPosition`. The fix must make its progress visible while keeping `onBackendChange` as the only event bridge back to backend viewport target.

Rejected alternative: draw a separate scrollbar in terminal-2 compositor.

Reason: that would split shell scrollbar from shell offscreen renderer ownership, which the previous projection law explicitly forbids.

## Risks / Trade-offs

- [Risk] OpenTUI's native selection APIs may not expose a direct setter for programmatic word/row selection.
  - Mitigation: keep a local gesture selection state inside `BackendFrameRenderable`, merge it into the same copy/paint path as drag selection, and continue using OpenTUI drag selection when no gesture selection is active.
- [Risk] `Intl.Segmenter` uses UTF-16 indices, while terminal columns use display width.
  - Mitigation: add explicit conversion helpers between terminal columns and string indices, and cover CJK behavior in tests.
- [Risk] Click count support may differ between OpenTUI mouse events and native terminal event streams.
  - Mitigation: support both event-provided click counts when available and a small internal click cadence tracker as a fallback.
- [Risk] Scrollbar visual styling may depend on OpenTUI internals.
  - Mitigation: keep the change to options/state passed into `ScrollBarRenderable` and add a rendered frame assertion rather than relying on private fields.


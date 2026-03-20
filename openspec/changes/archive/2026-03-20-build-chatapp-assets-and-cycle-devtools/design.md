## Context

The current stack already supports image upload at send time, optimistic user cycles, CodeMirror-based text input, and a separate cycle-inspection panel. That gives us a base to generalize, but the current interfaces are still image-specific (`uploadSessionImages`, `ChatImageAttachment`, `/images` routes), the Chat panel is still one monolithic feature, and the Cycles experience is optimized for storage inspection more than for real-time operator readability.

## Goals / Non-Goals

**Goals:**
- Turn Chat into a reusable ChatApp surface with a composable message viewport and composer toolkit.
- Generalize session attachment transport and storage from images to image/video/file.
- Add slash commands and screenshot capture without abandoning CodeMirror.
- Upgrade Cycles/Devtools into a live timeline and detail surface that complements Chat instead of competing with it.

**Non-Goals:**
- Adding backend-native screenshot capture.
- Implementing arbitrary future attachment types beyond image/video/file.
- Replacing the existing session-cycle storage model or LoopBus semantics.

## Decisions

- Keep send-time upload for all attachment kinds. This matches the current image flow, keeps the composer stateless with respect to server assets until send, and avoids a larger pending-asset state machine.
- Generalize the current image attachment model in place instead of creating a separate parallel asset system. Session DB, runtime projections, client types, and media routes all move to a generic asset vocabulary.
- Keep CodeMirror as the composer core and layer `/` and `@` completions into the same completion system so interaction stays consistent.
- Implement screenshot capture in the browser only: grab a still image, convert it into a pending image attachment, and stop the media tracks immediately.
- Split ChatApp UI into smaller project-local components so the route composition stays readable and testable.
- Keep Cycles in Devtools, but change the presentation from passive accordion dump to live timeline + detail view with virtualization and selected-cycle detail mounting.

## Risks / Trade-offs

- [Generic asset support expands too many layers at once] → Land the new asset vocabulary end-to-end first, then refactor the surface components onto it.
- [Video/file previews regress simpler image behavior] → Preserve image preview tests and add per-kind rendering contracts.
- [Composer completion logic becomes too stateful] → Reuse the existing CodeMirror completion path and keep slash/path sources isolated.
- [Cycle timeline becomes expensive again] → Virtualize the list, memoize cycle-row projections, and mount heavier detail renderers only for the selected cycle.

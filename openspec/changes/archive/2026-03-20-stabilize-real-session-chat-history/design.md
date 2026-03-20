## Context

The conversation-first Chat restoration fixed the main product direction, but the most recent regression showed that real session behavior can still drift away from mocked and short-history behavior. The risk is concentrated in the cross-package path from app-server chat persistence, to client-sdk hydration and selector publication, to WebUI viewport ownership and virtualization. The next change needs to validate and harden that full path against long persisted histories, prepended pagination, optimistic rows, streamed replies, attachment-bearing turns, and notification consumption on both desktop and mobile.

## Goals / Non-Goals

**Goals:**
- Make opening a real session reliably populate the Chat route with persisted messages before the user needs to interact again.
- Keep long histories visible when the Chat viewport switches from inline rendering to virtualization.
- Preserve a stable message-first reading flow while prepending older pages, appending streamed replies, and merging optimistic turns into persisted history.
- Keep unread consumption tied to the visible assistant reply boundary even when the viewport is paged and virtualized.
- Expand validation so future regressions are caught by unit, Storybook DOM, Playwright, and real-session walkthrough evidence.

**Non-Goals:**
- Redesigning the Chat surface again or reintroducing cycle-oriented Chat chrome.
- Changing the durable session schema or notification semantics beyond viewport-consumption correctness.
- Adding new product features unrelated to Chat history stability.

## Decisions

- **Treat the real-session data path as one contract.** Fixes will be designed across app-server, client-sdk, and WebUI together instead of patching the visual symptom in isolation. The alternative was to keep chasing individual rendering bugs, but that would miss hydration and selector drift that only appears in real sessions.
- **Keep message-first Chat and harden the viewport contract.** The fix scope will stay on `messages + transient overlays`, while explicitly validating width, height, and scroll ownership in the virtualized viewport. The alternative was to fall back to a non-virtualized list for long histories, but that would trade correctness for performance debt.
- **Separate session hydration correctness from hot publication correctness.** Initial route entry must ensure persisted chat and cycle data are available, while hot runtime updates must remain scoped so unrelated shell layers do not rerender. The alternative was a single broad `hydrate everything on route entry` path, which is simpler short-term but keeps the performance profile noisy.
- **Use viewport-driven notification consumption, not route-level guesses.** Unread consumption will continue to be anchored to the last actually visible assistant reply, with tests that exercise paged and virtualized histories. The alternative was to collapse unread state when the route becomes active, but that would violate the true per-message unread contract.
- **Require browser evidence for long-history regressions.** This change will add walkthrough evidence for desktop and mobile real-session flows in addition to unit and Storybook DOM tests. The alternative was to trust mocked fixtures only, which already proved insufficient.

## Risks / Trade-offs

- [Real-session failures may be data-dependent rather than purely structural] → Build reproducible fixtures and walkthrough scripts that use persisted histories, attachments, and resumed sessions.
- [Virtualized viewport fixes can regress scroll behavior while prepending pages] → Add targeted tests for long history entry, pagination, and sticky-bottom behavior before changing the viewport implementation.
- [Hydration fixes can accidentally widen rerender scope] → Keep runtime-store selector changes session-local and verify them against existing render-stability tests.
- [Notification consumption can become flaky under virtualization] → Assert visibility-driven consumption from the actual rendered assistant rows instead of synthetic route assumptions.

## Migration Plan

- No data migration is planned.
- Rollout is code-only: tighten hydration, viewport contracts, and tests together.
- If a fix regresses route performance, fall back by reverting the specific viewport or selector change without changing persisted session data.

## Open Questions

- Whether current real-session failures are concentrated in one viewport branch or split between hydration timing and virtualization layout.
- Whether one additional session-fixture harness is enough, or whether we need a reusable persisted-history generator for ongoing regression coverage.

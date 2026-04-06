## Context

The current workbench shell already moved toward the Chrome-window model, but real browser evidence still shows three structural leaks:

1. the left shell footer still renders an auth/bootstrap card (`Unauthenticated`) that behaves like a fourth navigation surface.
2. the room toolbar content is mounted too close to transcript content, so the avatar/title/chips band visually bleeds into the message list.
3. narrow viewports keep the same tab and toolbar structure without enough responsive collapse, causing overlap and clipping.

This round should repair those layout laws without reopening unrelated room-management, asset, or auth-system work.

## Goals / Non-Goals

**Goals:**

- restore the primary shell to a strict three-entry destination model.
- make the room workbench honor a fixed `page_toolbar` band above `page_content`.
- keep `page_content` as the only room stage and ensure only the transcript list scrolls.
- make desktop and iPhone 14 layouts both preserve usable tabs, toolbar actions, chips, transcript, and composer.

**Non-Goals:**

- redesigning room management flows or adding new room features.
- changing message semantics, auth semantics, or room membership logic.
- reworking unrelated Avatars or Terminals page behavior beyond shared shell fallout.

## Decisions

### 1. Treat shell footer affordances as auxiliary, not navigational

The left shell keeps the three primary destinations and nested running-avatar entries, but auth/bootstrap affordances must move into a distinct footer auxiliary slot or disappear from the navigation surface entirely. This preserves the original system-first navigation law.

### 2. Keep room window chrome in explicit bands

The Messages room route must render its selected room through one explicit window hierarchy:

- `chrome_tabs`
- `page_toolbar`
- `page_content`

The toolbar gets a fixed block size and does not share flow space with transcript rows. Toolbar content may use container queries and JS width state, but those are content concerns inside the fixed toolbar band.

### 3. Keep transcript scrolling owned by the chat stage

Inside `page_content`, the shared chat view owns two regions only:

- `messages_list`
- `message_toolbar`

`messages_list` is the only scroll owner. The composer toolbar stays pinned to the bottom of the stage so shell wrappers do not introduce extra scrolling or padding layers.

### 4. Compact behavior collapses secondary chrome first

On narrow viewports, the route keeps transcript and composer readable first. Tabs may scroll horizontally, toolbar metadata may wrap or truncate inside its fixed band, and action groups may compact, but the transcript stage must not be pushed under floating chrome.

## Risks / Trade-offs

- [Risk] Tightening shell/footer rendering may regress `/admin` or auth bootstrap entry visibility. → Mitigation: keep auxiliary affordance wiring intact while removing it from the primary destination surface.
- [Risk] Reworking toolbar containment may break existing chips/actions alignment on desktop. → Mitigation: verify both desktop and iPhone 14 after implementation with real browser evidence.
- [Risk] Moving scroll ownership can reintroduce nested overflow bugs. → Mitigation: keep `page_content` non-scrolling and validate that only the transcript list scrolls.

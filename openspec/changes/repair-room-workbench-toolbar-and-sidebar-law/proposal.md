## Why

Browser walkthroughs on desktop and iPhone 14 show that the current Svelte WebUI still violates the original workbench law in three places: the left shell leaks an extra auth/bootstrap card beyond the three primary destinations, the Messages room toolbar visually collapses into transcript space instead of behaving like fixed window chrome, and compact viewports let tabs and toolbar content overflow until they overlap the room transcript.

## What Changes

- Tighten the shared application shell so the primary navigation remains exactly `Avatars`, `Messages`, and `Terminals`, with auxiliary footer affordances staying outside that destination set.
- Repair the Messages room workbench so the Chrome-like window is always `chrome_tabs -> page_toolbar -> page_content`, and the toolbar remains a fixed-height chrome band that never overlaps transcript content.
- Repair the shared room/chat stage so the transcript owns the only scrollable list region, the composer stays pinned to the bottom of page content, and compact/mobile layouts reflow toolbar actions and tabs without visual collision.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `svelte-webui-platform`: tighten the three-destination shell contract so auth/bootstrap affordances do not appear as extra primary navigation entries or cards.
- `message-system-surface`: require the room workbench to keep a fixed toolbar band and responsive compact behavior without collapsing into the transcript stage.
- `web-chat-view`: require the shared chat stage to preserve one transcript scroll owner plus a pinned composer without toolbar/content overlap.

## Impact

- Affected code: `packages/webui`, `packages/web-chat-view`, and any shared layout wrappers the Messages route uses for window chrome.
- Affected behavior: desktop and compact Messages room layout, left shell rendering, responsive tab/tool chrome.

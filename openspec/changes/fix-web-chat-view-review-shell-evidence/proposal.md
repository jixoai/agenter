## Why

The Framework7 Svelte `web-chat-view` review report exposed real route-level defects: Framework7 icon glyphs leak as raw text, the iPhone source-detail child page can appear offset/half-open, and the overlay screenshot flow cannot reliably open resource previews from inline resource tokens. These are not message-system architecture changes; they are evidence-gated UI correctness bugs that must be fixed before the review shell can serve as trustworthy proof for the room-management refactor.

## What Changes

- Add BDD coverage for review-shell icon rendering so raw icon names such as `chat_bubble_2_fill`, `person_2_fill`, `tray_2_fill`, and `ellipsis` do not appear as visible user text.
- Add BDD coverage for mobile child-page stability so source detail is the active iPhone child page, the previous root page is not visible as an offset background, and primary tabbar chrome is suspended while the child page is active.
- Add BDD coverage for overlay entrypoints so inline resource tokens and aggregated resource tiles expose stable accessible activation paths.
- Fix the Framework7 review example implementation without inventing a second private shell or overlay system.
- Regenerate the screenshot-backed HTML report from the real example route after targeted verification.
- Include multiple self-review gates in the change so each round checks against the original findings and the long-term room/source/domain direction.

## Capabilities

### New Capabilities

- `web-chat-view-review-evidence`: Review-shell evidence closure for Framework7 icon integrity, mobile child-page stability, overlay activation, and screenshot-backed HTML reporting.

### Modified Capabilities

- `web-chat-view-framework7-visual-law`: Route-level screenshot evidence must include the repaired review-shell states and must not pass while known icon/mobile/overlay defects remain.
- `web-chat-view-framework7-overlay-resource-law`: Resource activation requirements now explicitly include stable accessible token entrypoints used by screenshot automation.
- `web-chat-view-people-shell`: Mobile child-page requirements now explicitly prohibit half-open/offset child surfaces and root tabbar leakage.

## Impact

- Affected packages: `@agenter/web-chat-view`, `@agenter/web-chat-view-example`.
- Affected scripts: review-shell screenshot/report flows under `packages/web-chat-view/example/scripts`.
- No database migration, no message-system runtime contract changes, and no backward-compatibility layer.

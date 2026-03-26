## Overview

This fix stays deliberately small. The duplication is not a rendering concern first; it starts in the client runtime store.

`runtime.snapshot` publishes recent in-memory `chatMessages` with ephemeral ids.
`chat.list` publishes persisted records with database-backed numeric ids.
When hydration merges both sources by `id` only, the same semantic message survives twice.

## Decision

Add a semantic duplicate check in `RuntimeStore.mergeChatMessages()`.

A runtime message is considered the same persisted record when these fields match:
- `role`
- `cycleId`
- `channel`
- normalized `format`
- `content`
- `timestamp`
- tool summary fields
- attachment identity fields

If both variants exist, keep the persisted numeric-id row and drop the in-memory row.

## Why This Layer

- It fixes the duplication once for every consumer of `chatsBySession`.
- It restores Chat long-history behavior without adding more transcript-specific heuristics.
- It avoids pushing persistence knowledge into the Chat projection layer.

## Verification

- Add a runtime-store test that hydrates persisted history over live runtime rows and asserts the persisted ids win.
- Keep browser verification at the WebUI level for desktop and mobile so the user-visible long-history route is proven end-to-end.

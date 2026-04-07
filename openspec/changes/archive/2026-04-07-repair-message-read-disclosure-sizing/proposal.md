## Why

The shared room transcript already exposes per-message read disclosure, but the disclosure panel collapses to content width instead of keeping a readable compact card width. On narrow viewports this turns the detail into an almost invisible white strip, which defeats the message-local read-detail contract.

This is not a message-domain problem. The shared `Popover.Content` sizing law currently relies on arbitrary Tailwind width utilities that are not stable inside this package build, so the primitive loses its intended inline size before the message feature can apply its own readable width.

## What Changes

- Move shared popover sizing to a durable primitive-level CSS contract instead of relying on arbitrary utility width classes.
- Let `message-read-indicator` provide an explicit readable disclosure width through that shared sizing hook.
- Add focused coverage for the read-disclosure sizing contract and verify the mobile room transcript renders the disclosure as a readable card.

## Impact

- `packages/web-chat-view`
- `openspec/specs/web-chat-view/spec.md`

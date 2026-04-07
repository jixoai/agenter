## Why

The shared `@agenter/web-chat-view` composer still treats websocket transport state as the final authority for footnote hints, even when the host supplies its own send handler. That leaks a false `Waiting for channel transport` warning into room-first surfaces that are already using host-managed send semantics.

This is a shared primitive contract bug: once the host owns sending, the composer must trust the host-provided hint instead of overriding it with transport-only copy.

## What Changes

- Make the shared composer honor `hintText` for host-managed send surfaces instead of replacing it with transport-wait copy.
- Add focused coverage for the host-managed hint contract in `@agenter/web-chat-view`.

## Impact

- `packages/web-chat-view`
- `openspec/specs/web-chat-view/spec.md`

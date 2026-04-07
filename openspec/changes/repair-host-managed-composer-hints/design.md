## Context

`web-chat-view-root.svelte` already computes the right `hintText`: host-managed send surfaces get `Enter to send, Shift+Enter for newline`, while transport-managed surfaces fall back to connection-state-specific copy. `default-composer.svelte` then overrides that contract a second time and shows `Waiting for channel transport` whenever `connectionState` is not `connected|idle`.

That second override is the bug. It reintroduces transport semantics after the host has already decided the correct hint.

## Decision

The shared composer will render the provided `hintText` as the single footnote truth. Connection-specific wording remains the responsibility of the host/root layer that computes `hintText`.

## Verification

- Focused `@agenter/web-chat-view` test coverage for host-managed hint rendering
- Targeted typecheck for `@agenter/web-chat-view` and `@agenter/webui`
- Browser verification on Messages new-room flow after creating and sending in a new room

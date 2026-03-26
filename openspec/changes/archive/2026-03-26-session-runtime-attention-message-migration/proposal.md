## Why

Session runtime still bridges chat, terminal, and attention through legacy local queues and V1 attention tools. That blocks the attention-first architecture.

## What Changes

- Migrate session-runtime to native attention contexts/items and MessageControlPlane.
- Replace old attention tools with native context/item tools.
- Route replies from committed attention items into message-system through LoopBus egress adapters.
- Split session stop semantics into stop vs abort.

## Impact

- Affected code: `packages/app-server`, `packages/client-sdk`, runtime snapshot/event payloads.

## Context

Message-system must become the chat platform kernel. App-server may host it, but it must not define the chat model.

## Decisions

### Control plane shape
`MessageControlPlane` owns:
- channel lifecycle
- focus set
- independent `chat.db`
- WebSocket transport
- event subscriptions

### Channel ids
- 1v1: `chat-*`
- group: `room-*`

### Core APIs
- `listChannels`
- `createChannel`
- `getChannel`
- `focus`
- `send`
- `reply`
- `queryMessages`
- `snapshot`
- `getConfig` / `setConfig`
- `startTransport` / `getTransportEndpoint`

### Transport
The transport endpoint is `ws://HOST:PORT/chat/$CHAT_ID`. Initial snapshot is pushed on connect, then incremental message events.

### Persistence
`chat.db` stores channels, messages, participants metadata, and context bindings. Session db remains runtime-facts only.

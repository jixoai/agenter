## 1. Message-system access model

- [x] 1.1 Extend message-system storage and types with channel access projections, token grants, and role-aware admin operations
- [x] 1.2 Require valid channel tokens for websocket transport, snapshot/page reads, send/reply flows, and other channel-scoped APIs
- [x] 1.3 Preserve trusted bootstrap for `listChannels` and `createChannel` while returning admin/member/readonly access projections

## 2. Adapter and UI integration

- [x] 2.1 Thread access projections through app-server and client-sdk without persisting raw secrets into session fact storage
- [x] 2.2 Add metadata update, participant management, and token issue/revoke flows to the chat-channel disclosure surface
- [x] 2.3 Update `web-chat-view` transport wiring to consume tokenized chat endpoints and role-aware metadata capabilities

## 3. Verification

- [x] 3.1 Add message-system, app-server, and client-sdk tests for role gating, metadata mutation, and token revocation
- [x] 3.2 Add WebUI and Storybook coverage for read-only versus admin metadata disclosure behavior
- [x] 3.3 Run desktop and mobile walkthroughs proving tokenized transport, metadata editing, and channel reuse flows

## Why

The current chat-channel stack is still trusted-session local. It can render multi-channel chat, but it cannot safely back a standalone ChatApp because channel operations do not have scoped credentials, metadata administration, or a clean bootstrap-to-token boundary.

## What Changes

- Add channel-scoped access tokens with explicit `admin`, `member`, and `readonly` roles.
- Keep `listChannels` and `createChannel` as trusted bootstrap APIs, but return tokenized access projections for all subsequent channel-scoped work.
- Require tokens for websocket transport, history reads, message writes, metadata updates, and token issuance or revocation.
- Add chat-channel metadata administration for title and participant management, including super-admin bootstrap at channel creation time.
- Wire the WebUI metadata disclosure surface to the new admin APIs so the future standalone ChatApp can reuse the same security model.

## Capabilities

### New Capabilities
- `chat-channel-access-control`: Tokenized access model for chat-channel transport and control-plane APIs.
- `chat-channel-metadata-admin`: Channel metadata mutation, participant management, and token issuance or revocation.

### Modified Capabilities
- `chatapp-surface`: Channel metadata disclosure can surface editable metadata and participant administration when the current token allows it.

## Impact

- Affected code: `packages/message-system`, `packages/app-server`, `packages/client-sdk`, `packages/webui`, `packages/web-chat-view`
- Affected APIs: chat transport URL generation, channel snapshot/page/send/update flows, TRPC adapters, runtime bootstrap payloads
- Data impact: chat-channel storage gains token grants/admin metadata while session db remains runtime-facts only

## Why

The current message-system operator flow still reflects a room-centric retrofit rather than the intended user-oriented collaboration surface. It also loses durable sender actor identity at persistence time, so same-label actors, viewer perspective, and "mine vs others" rendering cannot be made correct with UI-only fixes.

## What Changes

- **BREAKING** Persist durable sender actor identity on room messages and carry it through transport, paging, and shared chat rendering.
- Rebuild the message-system operator route around a chat-first flow with explicit viewer selection instead of a permanently expanded inline user-management rail.
- Move room administration, membership, and access controls into a dedicated dialog with sidebar-style organization so chat remains the main task surface.
- Upgrade the shared `@agenter/web-chat-view` custom element to render from explicit viewer actor context, preserve multi-user room semantics, and own scrolling through the shared `ScrollView` contract instead of route-local raw overflow.
- Keep room member options, profile labels, and avatars sourced from auth/profile truth, and keep send-as / read-progress state live without refresh.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `message-chat-control-plane`: room messages must preserve durable acting actor identity instead of only a display label.
- `message-system-surface`: the operator route must become user-oriented, chat-first, and dialog-driven for administration.
- `web-chat-view`: shared chat rendering must accept explicit viewer context and render durable multi-user room semantics.
- `scrollview-surface`: shared frontend transcript surfaces must delegate scrolling to `ScrollView`, including shared web components.

## Impact

- Affected systems: `message-system`, `app-server`, `client-sdk`, `web-chat-view`, `webui`
- Affected APIs/contracts: room message persistence, room transport payloads, room paging payloads, Web chat host props
- Affected tests: message-system BDD/DOM flows, shared chat component contracts, room transport regression coverage

## Why

The current WebUI chat route is still a session-local panel. It does not validate multi-channel chat as a first-class system.

## What Changes

- Add `packages/web-chat-view` as the React + CodeMirror chat-view package.
- Connect it to chat transport over `ws://HOST:PORT/chat/$CHAT_ID`.
- Migrate WebUI chat route to host the new package and prove multi-channel behavior.

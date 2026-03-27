## Why
- Session-bound routes still emit legacy `/workspace/*?sessionId=*` URLs, which breaks the agreed route contract and keeps query-coupled navigation alive.
- Terminal Activity still needs robust fallback mapping so legacy tool-call records render through the unified invocation card without empty-call noise.

## What Changes
- Move chat/terminals/settings session surfaces to canonical paths:
  - `/session/$sessionId/chats`
  - `/session/$sessionId/terminals`
  - `/session/$sessionId/settings`
- Keep devtools on `/session/$sessionId/devtools` and route all in-app tab navigation through session paths.
- Stop registering legacy workspace session routes (`/workspace/chat`, `/workspace/terminals`, `/workspace/settings`, `/workspace/devtools`).
- Update shell/session switching behavior to preserve current session tab using session paths.
- Ensure Terminal Activity maps legacy `yaml+tool_call|tool_result` records to `ToolInvocationCard` and suppresses empty call payload (`""`).

## Impact
- Breaking change: old workspace-query session URLs are no longer part of the route tree.
- Stronger route invariants for session hydration and navigation.
- Better consistency of tool-call visualization in terminal activity.

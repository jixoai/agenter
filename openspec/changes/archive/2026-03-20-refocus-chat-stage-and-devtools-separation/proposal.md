## Why

The current workspace Chat route still exposes too much kernel and debugging detail by default, so the UI reads like an internal operator console instead of a chat-first application. We need to restore a clear product hierarchy where Chat is the primary interaction surface, Devtools owns technical inspection, and status surfaces tell the user one actionable truth at a time.

## What Changes

- Rework the workspace Chat route so its default surface prioritizes conversation, composer, and one primary session action.
- Move cycle-centric and kernel-centric facts such as collected inputs, cycle badges, and technical inspection affordances out of the default Chat stream and into Devtools.
- Simplify workspace route chrome so workspace identity is compact and supporting, not a large competing card above the chat stage.
- Replace stacked passive/error statuses with a single route-relevant status summary that favors explicit recovery actions over vague messages such as `Unknown error`.
- **BREAKING**: Chat route presentation changes from cycle-first rendering to conversation-first rendering; cycle inspection becomes a Devtools responsibility.

## Capabilities

### New Capabilities
- `chat-surface-presentation`: defines the chat-first presentation contract for workspace sessions, including primary actions, empty states, and conversation-focused rendering.
- `workspace-devtools-surface`: defines the technical inspection surface that owns cycles, collected facts, loopbus state, terminal, model, and other debugging panels.

### Modified Capabilities
- `webui-chat-navigation`: workspace shell hierarchy changes so Chat, Devtools, and Settings have clearer responsibility boundaries and less duplicated route chrome.

## Impact

- Affected code is concentrated in `packages/webui`, especially `router.tsx`, `features/chat/*`, `features/shell/*`, and Devtools-related panels.
- Storybook DOM tests and unit/integration tests need to be updated to lock the new Chat-vs-Devtools separation.
- The change should reduce visible debug noise in Chat without changing session runtime semantics or LoopBus persistence contracts.

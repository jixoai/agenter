## Why

Durable room messaging already supports `send`, and this worktree has started wiring `edit`, but the platform still lacks the third correction primitive the user workflow needs: `recall`. Without a durable recall contract, the assistant is forced into noisy double-send behavior, and the shared chat surface cannot distinguish "this message was corrected in place" from "this is a second compensating reply".

This is now a platform-law gap rather than a prompt-only issue. The system needs one objective message-revision model that lets AI and operators send, edit, and recall the same durable room message, proves those behaviors with real-provider validation, and renders the resulting truth in the shared chat UI without feature-local guesswork.

## What Changes

- Add `message recall` as a first-class durable room-message mutation, parallel to `message edit` instead of hidden inside `message send`.
- Extend the message control plane, runtime tool surface, TRPC/client bindings, and transport payloads so edited or recalled messages are published as objective lifecycle updates on the same `messageId`.
- Define durable recall truth so recalled messages stop exposing stale user-visible content while still remaining visible as a recalled room fact.
- Teach the room-facing message skill and runtime tool catalog about `send`, `edit`, and `recall` as separate corrective actions.
- Update the shared chat transcript to render edited and recalled messages objectively instead of appending synthetic follow-up rows.
- Add real-provider validation scenarios that prove:
  - draft -> verify -> edit same durable message
  - draft -> recall -> send final durable message

## Capabilities

### New Capabilities

- `real-ai-message-revision-validation`: Real-provider validation that proves the assistant can naturally use durable `send`, `edit`, and `recall` message behaviors.

### Modified Capabilities

- `message-chat-control-plane`: Durable room messages gain sender-authorized recall and stronger lifecycle-update semantics for `send`, `edit`, and `recall`.
- `web-chat-view`: The shared transcript merges edited/recalled updates in place and renders revised-message truth objectively.

## Impact

- `packages/message-system/src/*`
- `packages/message-system/test/*`
- `packages/message-system/skills/message/SKILL.md`
- `packages/app-server/src/*`
- `packages/app-server/test/*`
- `packages/client-sdk/src/*`
- `packages/client-sdk/test/*`
- `packages/web-chat-view/src/*`
- `packages/webui/src/lib/features/messages/*`
- real-provider validation harnesses, prompts, and captured `.chat` evidence
- `openspec/specs/message-chat-control-plane/spec.md`
- `openspec/specs/web-chat-view/spec.md`

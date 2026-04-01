## Why

The current runtime still treats terminal, message, and task semantics as either missing prompt knowledge or ad hoc global prompt wording. That leaves the kernel blind to how each system should be understood, and real-model behavior drifts into the wrong shape: weather gets hallucinated instead of fetched through terminal, relay turns into mechanical quote forwarding, and task intent is mixed up with user-visible output.

There is also a compact-memory correctness bug in the same area. `readyReplies` currently derive trigger phrases by looking at the latest focused channel phrases globally, so an older reply in the same chat can inherit a later topic and become reusable for the wrong question after compact.

## What Changes

- Add a provider-owned `systemPrompt` contribution contract so active tool providers can inject their own usage guidance into model calls without coupling that guidance into `AgenterAI`.
- Make the session runtime's `message`, `terminal`, and `task` providers each publish their own prompt section describing what that system means and how it should be used.
- Extend system-prompt assembly so provider guidance is inserted through `SYSTEMS_GUIDE`, with a safe fallback for legacy templates that do not yet expose that slot.
- Fix compact ready-reply derivation so each `message_send` keeps the channel-local trigger provenance that actually preceded that dispatch.
- Add unit coverage for prompt injection and ready-reply provenance, then run targeted real-AI regression scenarios against the upgraded backend.

## Capabilities

### New Capabilities

- `task-control-plane`: Define task-system prompt semantics as a durable obligation ledger.

### Modified Capabilities

- `attention-runtime-kernel`: The kernel now assembles provider-owned system guides into the model `systemPrompt`.
- `message-chat-control-plane`: Message-system now owns its communication semantics in provider guidance instead of relying on generic global prompt text.
- `terminal-control-plane`: Terminal-system now owns its operating-system usage guidance in provider guidance.
- `attention-prompt-window-compaction`: Ready-reply facts now preserve per-dispatch provenance instead of inheriting later channel topics.

## Impact

- `packages/app-server/src/agenter-ai.ts`
- `packages/app-server/src/session-runtime.ts`
- `packages/i18n-en/prompts/SYSTEM_TEMPLATE.mdx`
- `packages/i18n-zh-Hans/prompts/SYSTEM_TEMPLATE.mdx`
- `packages/app-server/test/agenter-ai.test.ts`
- `packages/app-server/test/real-loopbus.integration.test.ts`
- `packages/app-server/test-support/real-loopbus-scenarios.ts`

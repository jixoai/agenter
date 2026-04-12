## Why

The current real-provider acceptance suite proves that the architecture works, but the user prompts in those scenarios are still too directive. That makes the model behave more like a scripted executor than a real software-delivery assistant, and it hides whether Avatar prompt law plus system guidance are actually strong enough for ordinary non-technical users.

## What Changes

- Add two new real-provider validation flows that keep the same product coverage as the current `1 user + 1 avatar` and `1 user + 2 avatars` scenarios, but replace step-by-step user scripts with more realistic novice-user requests.
- Strengthen shared Avatar prompt guidance so Avatars more clearly act like proactive software engineers who can translate vague user goals into concrete delivery steps without needing the user to micromanage tools.
- Strengthen system guide descriptions so Message / Terminal / Workspace guidance better teaches the model how to recover state, create terminals when missing, verify deliveries, and coordinate in shared rooms.
- Keep `UsageExamplePrompt` out of scope for now; only record it as the next escalation path if prompt-law tightening still proves insufficient.

## Capabilities

### New Capabilities
- `avatar-prompt-guidance`: durable prompt-law for Avatar capability, specialization, and ordinary-user interaction style.
- `realistic-user-real-ai-validation`: opt-in real-provider acceptance flows that validate ordinary-user single-avatar delivery and ordinary-user two-avatar collaboration.

### Modified Capabilities
- `attention-runtime-kernel`: prompt/system-guide assembly requirements now need to support ordinary-user intent translation and resource-recovery behavior without relying on test-scripted user instructions.

## Impact

- Affected code: localized prompt docs under `packages/i18n-*/prompts`, Message / Terminal / Workspace guide builders in `packages/app-server/src/session-runtime.ts`, and real-provider scenario helpers/tests under `packages/app-server/test-support` and `packages/app-server/test`.
- Affected operations: opt-in real-provider validation matrix gains two more realistic-user scenarios.
- Affected docs: OpenSpec capability specs plus backend/frontend integration notes where prompt-law or validation expectations become durable.

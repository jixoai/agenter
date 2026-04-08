## Why

Runtime avatars currently inherit a shared system prompt that hardcodes the assistant name as `agenter-ai`. When a room runs `jane`, `jj`, or any other avatar, the model still receives the wrong identity and can no longer speak about itself truthfully.

## What Changes

- Replace the hardcoded assistant label in localized `AGENTER_SYSTEM` prompt docs with the existing MDX `<Slot />` primitive for `AVATAR_NAME`.
- Thread the runtime avatar name into `AgenterAI` prompt composition so shared prompt docs render with the current avatar identity before the final `SYSTEM_TEMPLATE` is assembled.
- Update prompt-loading and runtime tests so the durable contract checks for slot-based identity instead of fixed `agenter-ai` prose.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `attention-runtime-kernel`: shared prompt docs now receive the current runtime avatar identity through prompt slots before the kernel assembles the outbound system prompt.

## Impact

- Affected code: `packages/app-server`, `packages/i18n-en`, `packages/i18n-zh-Hans`, `demo/test`
- Affected behavior: room avatars identify themselves with their own runtime name instead of a shared hardcoded default
- No new dependency or storage migration

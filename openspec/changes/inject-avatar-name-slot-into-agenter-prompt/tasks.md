## 1. OpenSpec Contract

- [ ] 1.1 Add the capability delta for avatar-aware prompt identity in `attention-runtime-kernel`
- [ ] 1.2 Sync the durable runtime spec after implementation so avatar slot injection becomes repository truth

## 2. Runtime Injection

- [ ] 2.1 Replace hardcoded assistant identity in localized `AGENTER_SYSTEM` prompt docs with `<Slot name="AVATAR_NAME" />`
- [ ] 2.2 Thread the runtime avatar name through `SessionRuntime` and `AgenterAI` so shared prompt docs render with `AVATAR_NAME`

## 3. Verification

- [ ] 3.1 Update runtime and prompt-store tests for slot-based avatar identity
- [ ] 3.2 Run focused tests for `@agenter/app-server` and `demo`, then record proof on the emergent-thinking board

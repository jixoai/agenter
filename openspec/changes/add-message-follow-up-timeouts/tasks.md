## 1. Contract surfaces

- [x] 1.1 Extend runtime-local `message send` descriptor/types/help to accept object-JSON `followUpAfterMs` and describe it as attention-only follow-up intent.
- [x] 1.2 Update message skill/reference guidance so follow-up reminders are explained as optional etiquette-driven re-evaluation rather than a mandatory rule or auto-reply timeout.
- [x] 1.3 Add code comments or durable doc notes that reminder state must stay out of `MessageRecord`, room snapshots, and room transport payloads.

## 2. Reminder-to-attention pipeline

- [x] 2.1 Introduce runtime-private reminder sidecar state keyed by `chatId`, `anchorMessageId`, sender/runtime identity, and `dueAt`.
- [x] 2.2 Arm reminder eligibility on successful `message send` and suppress it once the anchored message is no longer the latest visible room message.
- [x] 2.3 Convert each eligible due reminder into one committed attention item without creating a synthetic room message or automatic re-arm.
- [x] 2.4 Keep the initial timer bridge isolated behind a scheduler-facing abstraction so future `TaskSystem` migration does not change the external `message send` contract.

## 3. Regression coverage

- [x] 3.1 Add runtime CLI tests for `followUpAfterMs` validation, help text, and object-JSON-first usage.
- [x] 3.2 Add runtime attention/message tests for stale-anchor suppression, one-shot firing, and "attention only, no visible room auto-send" behavior.
- [x] 3.3 Add or refresh a real-AI room scenario that covers acknowledgement send, silence, reminder expiry, and the later explicit follow-up decision.

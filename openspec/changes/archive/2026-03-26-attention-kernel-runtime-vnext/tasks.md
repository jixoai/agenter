## 1. Attention-native runtime records

- [x] 1.1 Define attention-native runtime refs plus cycle-frame and egress record types in `packages/attention-system` and `packages/app-server`.
- [x] 1.2 Replace the current session-runtime collection path with source invalidation -> attention draft -> attention commit as the only semantic ingress.
- [x] 1.3 Persist cycle frames from attention refs instead of flattened `inputs / facts / reply` payloads.

## 2. Plugin pipeline and system adapters

- [x] 2.1 Extend the plugin runtime so ingress, scheduling, model-call, and egress phases all run through the same attention-first hook contract.
- [x] 2.2 Implement typed message-system and terminal-system egress adapters that dispatch from committed attention outcomes.
- [x] 2.3 Remove direct Chat publication from raw `attention-reply` activity and enforce the message-egress-only boundary.

## 3. Runtime publication and verification

- [x] 3.1 Update runtime publication, client-sdk selectors, and tool payloads to expose attention-native frames and egress records.
- [x] 3.2 Add integration coverage for multi-context scheduling, unresolved attention carry-over, and failed-vs-successful egress outcomes.
- [x] 3.3 Add regression coverage proving Chat only shows replies that were successfully dispatched into a chat channel.

## 4. Unresolved-attention autonomy follow-up

- [x] 4.1 Enforce that unresolved attention debt keeps scheduling model/tool work until attention state is mutated toward completion, even without new external input.
- [x] 4.2 Prevent attention-debt rounds from treating plain-text/no-op output as successful completion or leaking that output into Chat.
- [x] 4.3 Add regression coverage proving a `score > 0` attention item keeps driving follow-up rounds until an attention patch resolves or re-stages it.

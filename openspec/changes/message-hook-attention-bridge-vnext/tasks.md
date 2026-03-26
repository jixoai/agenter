## 1. Hook runtime simplification

- [x] 1.1 Remove generic egress registration/dispatch from the loop plugin runtime.
- [x] 1.2 Make committed hooks return structured hook results and wire them into `attention_commit` responses.

## 2. Message bridge

- [x] 2.1 Implement the message commit hook that extracts channel messages from eligible commits.
- [x] 2.2 Add the direct `message_send` AI tool backed by message-system trusted runtime access.
- [x] 2.3 Remove terminal auto-consumption of attention commits.

## 3. Verification

- [x] 3.1 Add integration tests for delivered / failed / ignored hook outcomes.
- [x] 3.2 Regress the broken "chat message unresolved but loop stopped" workflow.

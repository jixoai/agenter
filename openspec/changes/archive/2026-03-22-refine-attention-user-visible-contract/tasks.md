## 1. Attention contract

- [x] 1.1 Add proposal, design, and specs for the user-visible attention contract reset
- [x] 1.2 Update attention-system and app-server tool schemas to use `attention_update` and `attention_query(minScore)`
- [x] 1.3 Remove internal attention preview injection from session runtime streaming

## 2. Chat projection

- [x] 2.1 Change optimistic/persisted chat dedupe to use `clientMessageId` and cycle identity first
- [x] 2.2 Ensure Chat only renders user-facing assistant output (`to_user` or undefined)
- [x] 2.3 Keep internal attention activity available only in inspection/devtools paths

## 3. Verification

- [x] 3.1 Add attention engine and app-server tool regression tests for `minScore` and internal update semantics
- [x] 3.2 Add chat projection tests for single-row dedupe and no leaked attention output
- [x] 3.3 Run targeted tests and update this task list from verified results

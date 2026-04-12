## 1. OpenSpec Capture

- [x] 1.1 Review the attention-context bootstrap task prompt against current backend/runtime facts.
- [x] 1.2 Add proposal, design, and spec deltas that record `systemPrompt` purity and attention-bootstrap ownership.

## 2. Already-Landed Guardrails

- [x] 2.1 Record the existing `agenter-ai` guardrail: provider-owned system guides no longer enter `systemPrompt`.
- [x] 2.2 Record the existing `session-runtime` guardrail: bootstrap emits `context` first, `items` second, and grouped system guides come from active attention contexts.

## 3. Remaining Runtime Hardening

- [x] 3.1 Audit remaining dynamic system help sources and confirm there is no leftover provider-owned prompt glue outside `AttentionContextGuideProvider`.
- [x] 3.2 Audit compact, replay, and prompt-window rebuild paths so bootstrap/delta semantics do not depend on one exact `items` wire shape.

## 4. Verification

- [x] 4.1 Extend tests to prove inactive systems disappear from bootstrap while active systems emit both one-line descriptions and long grouped guides.
- [x] 4.2 Extend persistence inspection coverage for `attentionContextIds` and `attentionCommitRefs` across normal rounds and compact-adjacent paths.

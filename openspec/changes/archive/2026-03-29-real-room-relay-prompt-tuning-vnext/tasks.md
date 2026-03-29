## 1. Platform Contract Reduction

- [x] 1.1 Make `attention_commit` accept the minimal tool input needed by models, letting runtime default `meta.author/source`, and lock it with unit coverage.
- [x] 1.2 Strengthen multilingual system prompt and tool descriptions so chat-backed work stays unfinished until visible dispatch and attention settlement both happen.

## 2. Real Provider Regression

- [x] 2.1 Update the real LoopBus scenario helpers and test to use the natural two-room relay flow and the post-`/compact` follow-up assertion.
- [x] 2.2 Run the targeted real-provider regression, verify `kzf -> gaubee -> kzf` and post-compact follow-up, and capture any remaining protocol gap as evidence.

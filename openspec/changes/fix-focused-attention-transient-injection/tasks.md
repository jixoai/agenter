## 1. Behavior Tests

- [ ] 1.1 Add AgenterAI BDD coverage proving transient attention protocol inputs are sent in the current provider request but not replayed from prompt-window memory.
- [ ] 1.2 Add SessionRuntime BDD coverage proving focus transitions do not inject historical item batches and focused new commits still inject item deltas.
- [ ] 1.3 Add SessionRuntime BDD coverage proving restart/compact boundary refresh injects AttentionContext projection without historical AttentionItems.

## 2. Runtime Implementation

- [ ] 2.1 Split AgenterAI prompt-window persistence from current provider request assembly for attention protocol inputs.
- [ ] 2.2 Remove cursor-style historical fallback from SessionRuntime attention item prompt selection.
- [ ] 2.3 Preserve provider request ledger truth for transient attention inputs and interleaved continuations.
- [ ] 2.4 Ensure AI-authored attention tool commits update context state without scheduling item replay.

## 3. Specs And Docs

- [ ] 3.1 Add delta specs for focused transient attention injection and prompt-window exclusion.
- [ ] 3.2 Update durable app-server/root specs with the new platform law.
- [ ] 3.3 Add a plain-language explanation of why context is boundary-injected and items are in-flight injected.

## 4. Verification

- [ ] 4.1 Run focused app-server tests and typecheck.
- [ ] 4.2 Perform a real request/DB walkthrough showing historical `ctx-skill-system` attention protocol payloads are not replayed.

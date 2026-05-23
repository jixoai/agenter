## 1. Contract And Tests

- [ ] 1.1 Add BDD coverage for context-preserving attention commits in `packages/attention-system`.
- [ ] 1.2 Add BDD coverage proving message ingress preserves an Avatar-authored room attention context.

## 2. Implementation

- [ ] 2.1 Add an explicit attention commit context-mutation intent with compatible default apply behavior.
- [ ] 2.2 Mark message-system attention drafts as context-preserving and pass the intent through draft commit.
- [ ] 2.3 Add code comments documenting the message-system boundary against attentionContext abuse.

## 3. Spec Sync And Verification

- [ ] 3.1 Sync durable specs for attention context and session runtime message ingress.
- [ ] 3.2 Run focused attention-system and app-server attention-message tests.

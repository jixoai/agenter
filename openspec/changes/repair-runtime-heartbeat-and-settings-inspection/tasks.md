## 1. Spec

- [ ] 1.1 Add OpenSpec deltas for runtime Heartbeat inspection and runtime Settings provenance restoration

## 2. Backend Contracts

- [ ] 2.1 Add a paged runtime contract for `request_aux` ledger rows
- [ ] 2.2 Add backend tests proving `request_aux` paging preserves `systemPrompt`, `tools`, and `config` facts in durable order

## 3. Client Contracts

- [ ] 3.1 Add runtime-store support for request-aux paging and runtime-scoped settings graph loading
- [ ] 3.2 Add contract-first tests for runtime settings scope resolution and Heartbeat inspection merge behavior

## 4. WebUI Binding

- [ ] 4.1 Restore runtime Settings to the scoped provenance/layer panel
- [ ] 4.2 Upgrade Heartbeat to render runtime inspection entries from heartbeat rows, request-aux rows, and model-call cards
- [ ] 4.3 Add focused Storybook / DOM coverage for the repaired Settings and Heartbeat bindings

## 5. Verification

- [ ] 5.1 Run targeted backend and client tests
- [ ] 5.2 Run targeted WebUI tests
- [ ] 5.3 Browser-walk the repaired runtime shell and confirm Heartbeat/Settings are objectively inspectable


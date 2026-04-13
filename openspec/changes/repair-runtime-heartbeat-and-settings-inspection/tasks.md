## 1. Spec

- [x] 1.1 Add OpenSpec deltas for runtime Heartbeat inspection and runtime Settings provenance restoration

## 2. Backend Contracts

- [x] 2.1 Add a paged runtime contract for `request_aux` ledger rows
- [x] 2.2 Add backend tests proving `request_aux` paging preserves `systemPrompt`, `tools`, and `config` facts in durable order

## 3. Client Contracts

- [x] 3.1 Add runtime-store support for request-aux paging and runtime-scoped settings graph loading
- [x] 3.2 Add contract-first tests for runtime settings scope resolution and Heartbeat inspection merge behavior

## 4. WebUI Binding

- [x] 4.1 Restore runtime Settings to the scoped provenance/layer panel
- [x] 4.2 Upgrade Heartbeat to render runtime inspection entries from heartbeat rows, request-aux rows, and model-call cards
- [x] 4.3 Add focused Storybook / DOM coverage for the repaired Settings and Heartbeat bindings

## 5. Verification

- [x] 5.1 Run targeted backend and client tests
- [x] 5.2 Run targeted WebUI tests
- [x] 5.3 Browser-walk the repaired runtime shell and confirm Heartbeat/Settings are objectively inspectable

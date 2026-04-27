## 1. OpenSpec Truth

- [x] 1.1 Add delta specs for terminal control-plane, runtime terminal contract, terminal system surface, and runtime JSON descriptors.
- [x] 1.2 Sync durable specs so the actor-scoped read cursor law is documented outside the transient change.

## 2. Terminal Kernel / Control Plane

- [x] 2.1 Remove terminal-global dirty read cursor state from terminal-core.
- [x] 2.2 Add durable `(terminalId, readerActorId)` read cursor storage.
- [x] 2.3 Resolve read cursor ownership through actor credentials and terminal access tokens.
- [x] 2.4 Keep `remark` cursor consumption independent from `recordActivity`.

## 3. Runtime / Client / WebUI

- [x] 3.1 Propagate read cursor metadata through runtime and client store payloads.
- [x] 3.2 Make WebUI terminal reads use the selected actor access token with consuming `remark:true`.
- [x] 3.3 Expose `remark` in runtime CLI/tool schema and help without shifting existing compact `recordActivity` position.
- [x] 3.4 Update built-in terminal skill guidance and generated catalog.

## 4. Verification

- [x] 4.1 Add BDD coverage for independent actor cursors and token-backed reader identity.
- [x] 4.2 Add BDD coverage for runtime/client/WebUI propagation and CLI/help contract.
- [x] 4.3 Run targeted typecheck/test suites and strict OpenSpec validation.

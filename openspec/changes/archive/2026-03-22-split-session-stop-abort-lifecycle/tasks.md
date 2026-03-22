## 1. Lifecycle contract

- [x] 1.1 Add proposal, design, and specs for pause/abort session lifecycle
- [x] 1.2 Extend app-server lifecycle types and tRPC procedures with `paused` status and `session.abort`
- [x] 1.3 Split `SessionRuntime` into non-destructive pause and destructive abort semantics

## 2. Client and UI migration

- [x] 2.1 Update client-sdk runtime/session reducers so pause keeps runtime history while abort detaches runtime state
- [x] 2.2 Update Chat/WebUI toolbar copy to `Paused / Resume` and move `Abort` to advanced actions
- [x] 2.3 Prevent passive inspection flows from implicitly starting paused or stopped sessions

## 3. Verification

- [x] 3.1 Add backend tests for pause, resume, abort, and in-flight model cancellation
- [x] 3.2 Add client/webui regression tests for paused session state and retained inspection data
- [x] 3.3 Run targeted tests and update this task list from verified results

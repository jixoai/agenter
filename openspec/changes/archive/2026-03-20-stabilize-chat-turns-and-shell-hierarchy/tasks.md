## 1. OpenSpec and lifecycle foundation

- [x] 1.1 Add the change artifacts for model-call lifecycle, chat-visible cycle filtering, and shell hierarchy cleanup
- [x] 1.2 Extend session-system model-call records and storage APIs to support running/done/error lifecycle updates with completion timestamps

## 2. Runtime and client lifecycle handling

- [x] 2.1 Persist model calls at request start, update them on completion/error, and emit realtime lifecycle updates for the same logical record
- [x] 2.2 Add runtime timeout handling so stalled model calls become persisted error completions and recoverable turn failures
- [x] 2.3 Update client-sdk runtime-store merge logic for running-to-done/error model-call updates and related cycle progress state

## 3. Chat-stage and shell cleanup

- [x] 3.1 Refactor chat projection so Chat only renders user-visible cycles while Devtools still retains background cycles
- [x] 3.2 Simplify shell ownership across `SidebarNav`, `AppHeader`, `WorkspaceShellFrame`, and `SessionToolbar` to remove repeated workspace/session facts
- [x] 3.3 Update Devtools model inspection so in-flight model calls appear immediately with request payloads and completion/error details

## 4. Verification

- [x] 4.1 Add or update unit and integration tests for model-call lifecycle, timeout behavior, and chat-visible cycle filtering
- [x] 4.2 Update Storybook DOM tests for the revised Chat, Devtools, and shell hierarchy contracts
- [x] 4.3 Run focused verification (`test`, targeted app-server/client-sdk/webui suites, and browser walkthrough) and fix regressions until the change is ready

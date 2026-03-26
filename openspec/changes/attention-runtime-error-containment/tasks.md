## 1. Containment Contract

- [x] 1.1 Finalize the runtime error-containment proposal, design, and delta specs for scheduler containment, cancellation, and publication state
- [x] 1.2 Refactor the attention/session runtime so unresolved debt, runnable wake causes, and cycle outcomes are modeled as distinct scheduler state
- [x] 1.3 Add retry-budget and equivalent-failure/no-progress containment so repeated unproductive rounds transition to `backoff` or `blocked`

## 2. Control Plane And Publication

- [x] 2.1 Thread shared `AbortSignal` cancellation through runtime model/tool execution and map stop/abort onto explicit cancellation behavior
- [x] 2.2 Persist containment metadata and canceled model-call outcomes in runtime facts and model-call records
- [x] 2.3 Publish scheduler containment state through `packages/client-sdk` selectors and surface it in the minimal WebUI/runtime inspectors needed for diagnosis

## 3. Verification

- [x] 3.1 Add unit/integration coverage for no-progress detection, retry containment, wake-cause gating, and canceled model-call persistence
- [x] 3.2 Run real-AI runtime scenarios that prove solvable attention debt continues progressing while repeated equivalent failure/no-progress paths stop burning tokens
- [x] 3.3 Document the containment law in project best-practice guidance so future runtime changes do not reintroduce unconditional self-wake loops

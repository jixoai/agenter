## 1. Terminal Activity Bridge

- [ ] 1.1 Introduce a runtime terminal activity bridge that classifies terminal changes as passive observation or actionable ingress.
- [ ] 1.2 Refactor terminal adapter observation flow so dirty markers and wait handles feed the bridge instead of directly implying loop ingress.
- [ ] 1.3 Preserve lifecycle ingress as explicit terminal-originated ingress while keeping ordinary snapshot/diff observation under bridge control.

## 2. Runtime Scheduling And Focus Wiring

- [ ] 2.1 Update session runtime scheduling so bridge-approved ingress is the only terminal wake source for model work.
- [ ] 2.2 Keep actor-scoped terminal focus as eligibility truth while removing the assumption that every focused terminal semantic change must wake the loop.
- [ ] 2.3 Add focused unit/integration coverage proving one physical terminal change maps to at most one runtime wake decision.

## 3. Validation Harness And Process Hygiene

- [ ] 3.1 Remove the shared-terminal collaboration test's dependency on `session.pause()` and validate the same behavior under live runtime loops.
- [ ] 3.2 Extend terminal-backed validation helpers to capture process/port ownership and cleanup evidence for the current run.
- [ ] 3.3 Update real/shared terminal validation flows so bridge-governed runtime follow-up and process hygiene failures are observable in backend evidence.

## 4. Verification And Closeout

- [ ] 4.1 Run targeted app-server terminal/runtime tests covering bridge classification, scheduler wake behavior, and shared-terminal collaboration.
- [ ] 4.2 Run relevant real/opt-in terminal validation entrypoints or document why they could not be executed in this turn.
- [ ] 4.3 Sync durable specs if implementation changes require it, then archive `decouple-terminal-activity-from-runtime-loop` and commit the completed change.

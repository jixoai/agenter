## 1. Runtime + persistence contract

- [x] 1.1 Replace runtime/session channel contract from `tool_call|tool_result` to `tool`.
- [x] 1.2 Upgrade tool metadata to structured invocation payload (id/status/call/result/error/timestamps).
- [x] 1.3 Update stream handling to upsert a single live invocation message and mark cancelled on interruption.

## 2. Devtools and terminal rendering

- [x] 2.1 Rework cycle execution normalization to consume structured invocation fields directly.
- [x] 2.2 Rework terminal activity rendering to consume structured invocation fields directly.
- [x] 2.3 Remove remaining panel-local legacy tool trace rendering branches.

## 3. Chat and markdown cleanup

- [x] 3.1 Remove `tool_call/tool_result` channel handling from Chat markdown rendering.
- [x] 3.2 Keep Chat conversation projection user-facing-only under the new `tool` channel model.

## 4. Verification

- [x] 4.1 Update impacted unit and Storybook DOM tests for the new invocation schema and statuses.
- [x] 4.2 Run `typecheck` + impacted package test suites.

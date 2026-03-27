## 1. Shared invocation contract

- [ ] 1.1 Introduce a shared `ToolInvocationView` type and `ToolInvocationCard` component in WebUI.
- [ ] 1.2 Ensure `ToolInvocationCard` renders all lifecycle states (`waiting/running/success/failed/cancelled`) with YAML-first payload previews.

## 2. Panel adoption

- [ ] 2.1 Replace cycle detail tool trace rendering with `ToolInvocationCard`.
- [ ] 2.2 Replace terminal activity tool lifecycle rendering with `ToolInvocationCard`.
- [ ] 2.3 Align model inspection invocation sections to the shared invocation renderer where invocation data exists.

## 3. Cleanup and verification

- [ ] 3.1 Remove panel-local duplicated tool rendering branches that become dead after adoption.
- [ ] 3.2 Add/update Storybook DOM + unit coverage for shared invocation states and panel integration.
- [ ] 3.3 Run WebUI verification (`typecheck`, relevant unit tests, relevant DOM tests).

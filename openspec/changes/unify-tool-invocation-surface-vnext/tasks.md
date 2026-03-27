## 1. Shared invocation contract

- [x] 1.1 Introduce a shared `ToolInvocationView` type and `ToolInvocationCard` component in WebUI.
- [x] 1.2 Ensure `ToolInvocationCard` renders all lifecycle states (`waiting/running/success/failed/cancelled`) with YAML-first payload previews.

## 2. Panel adoption

- [x] 2.1 Replace cycle detail tool trace rendering with `ToolInvocationCard`.
- [x] 2.2 Replace terminal activity tool lifecycle rendering with `ToolInvocationCard`.
- [x] 2.3 Align model inspection invocation sections to the shared invocation renderer where invocation data exists.

## 3. Cleanup and verification

- [x] 3.1 Remove panel-local duplicated tool rendering branches that become dead after adoption.
- [x] 3.2 Add/update Storybook DOM + unit coverage for shared invocation states and panel integration.
- [x] 3.3 Run WebUI verification (`typecheck`, relevant unit tests, relevant DOM tests).

## 4. Terminal activity parity fixes

- [x] 4.1 Ensure terminal activity tool rows always render through `ToolInvocationCard`, including legacy yaml-fence tool payload rows.
- [x] 4.2 Ensure empty invocation input payloads are omitted from the card instead of rendering `""`.
- [x] 4.3 Add focused unit + Storybook checks for the empty-input omission behavior and terminal activity fallback mapping.

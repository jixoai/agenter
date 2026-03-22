## 1. Runtime contract propagation

- [x] 1.1 Add OpenSpec proposal, design, and capability specs for runtime/client/webui terminal contract propagation
- [x] 1.2 Update app-server snapshot and realtime payloads so `focusedTerminalIds` and terminal read representation metadata are first-class
- [x] 1.3 Keep temporary derived compatibility fields only where active consumers still require them

## 2. Client-sdk migration

- [x] 2.1 Update client-sdk runtime-store types, reducers, and selectors for the new terminal contract
- [x] 2.2 Remove store-level assumptions that there is exactly one focused terminal or one diff-only terminal read path
- [x] 2.3 Add runtime-store regression tests for focus-set handling and terminal representation metadata

## 3. WebUI migration and verification

- [x] 3.1 Update WebUI terminal/devtools consumers to follow the new focus/read contracts directly
- [x] 3.2 Add Storybook DOM tests for terminal/devtools interaction and rendering contracts
- [x] 3.3 Run focused client-sdk + webui tests and update task status from the verified result

## Execution Notes

- Start from runtime payloads and store normalization before touching WebUI rendering branches.
- Keep any remaining compatibility field explicitly derived and short-lived; do not add new business logic on top of compatibility shims.
- Use Storybook DOM for composite terminal/devtools interaction instead of mocked-only assertions.

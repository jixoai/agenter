## 1. Backend launch truth contracts

- [x] 1.1 Add explicit terminal `backend` durable launch truth to terminal-system create/list/get-config/set-config contracts and storage.
- [x] 1.2 Extend app-runtime and client-sdk terminal-binding contracts so cli-shell can request and inspect backend launch truth without importing core internals.
- [x] 1.3 Add official Termless backend factory/adapter wiring for `xterm` and `ghostty-native` without reintroducing Agenter-private backend ownership.
- [x] 1.4 Add contract tests for omitted-backend defaulting, explicit `ghostty-native`, unsupported backend errors, and backend/renderer separation.

## 2. Cli-shell backend orchestration

- [x] 2.1 Parse `--backend` in cli-shell argv and thread it through bootstrap inputs and terminal ensure calls.
- [x] 2.2 Implement backend-aware terminal reuse policy: update stopped terminals, reject running backend mismatches, and keep explicit failure messages.
- [x] 2.3 Add cli-shell unit and integration tests for `bun agenter shell --backend=ghostty-native` and backend mismatch behavior.

## 3. Bottom single-line projection

- [x] 3.1 Replace bottom multi-row rendering with a one-line markdown projection helper built from OpenTUI `MarkdownRenderable` plus last-line extraction.
- [x] 3.2 Update cli-shell TUI model/controller/frame law so the bottom row remains display-only and transcript chrome stays side or floating.
- [x] 3.3 Remove multi-row bottom smart-placement behavior and keep `bottom` as projection-only mode.
- [x] 3.4 Add focused TUI tests for constrained-width markdown projection, last-line clipping, no multi-row bottom panel, and preserved terminal input ownership.

## 4. Verification

- [x] 4.1 Run targeted tests for terminal-system, client-sdk/app-runtime, and cli-shell.
- [x] 4.2 Run `openspec validate promote-ghostty-native-cli-shell --strict`.
- [x] 4.3 Perform a real local walkthrough of `bun agenter shell --backend=ghostty-native`, including actual terminal input and observable output.

## 1. Backend launch truth contracts

- [ ] 1.1 Add explicit terminal `backend` durable launch truth to terminal-system create/list/get-config/set-config contracts and storage.
- [ ] 1.2 Extend product-extension-runtime and client-sdk terminal-binding contracts so cli-shell can request and inspect backend launch truth without importing core internals.
- [ ] 1.3 Add official Termless backend factory/adapter wiring for `xterm` and `ghostty-native` without reintroducing Agenter-private backend ownership.
- [ ] 1.4 Add contract tests for omitted-backend defaulting, explicit `ghostty-native`, unsupported backend errors, and backend/renderer separation.

## 2. Cli-shell backend orchestration

- [ ] 2.1 Parse `--backend` in cli-shell argv and thread it through bootstrap inputs and terminal ensure calls.
- [ ] 2.2 Implement backend-aware terminal reuse policy: update stopped terminals, reject running backend mismatches, and keep explicit failure messages.
- [ ] 2.3 Add cli-shell unit and integration tests for `bun agenter shell --backend=ghostty-native` and backend mismatch behavior.

## 3. Bottom single-line projection

- [ ] 3.1 Replace bottom multi-row rendering with a one-line markdown projection helper built from OpenTUI `MarkdownRenderable` plus last-line extraction.
- [ ] 3.2 Update cli-shell TUI model/controller/frame law so the bottom row remains display-only and transcript chrome stays side or floating.
- [ ] 3.3 Remove multi-row bottom smart-placement behavior and keep `bottom` as projection-only mode.
- [ ] 3.4 Add focused TUI tests for constrained-width markdown projection, last-line clipping, no multi-row bottom panel, and preserved terminal input ownership.

## 4. Verification

- [ ] 4.1 Run targeted tests for terminal-system, client-sdk/product-extension-runtime, and cli-shell.
- [ ] 4.2 Run `openspec validate promote-ghostty-native-cli-shell --strict`.
- [ ] 4.3 Perform a real local walkthrough of `bun agenter shell --backend=ghostty-native`, including actual terminal input and observable output.

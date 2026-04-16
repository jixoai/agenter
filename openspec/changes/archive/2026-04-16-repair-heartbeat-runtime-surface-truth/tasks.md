## 1. Runtime publication and ledger projection

- [x] 1.1 Audit the grouped Heartbeat publication path so running invocation input hydration triggers the same grouped refresh/invalidation path as completion events.
- [x] 1.2 Ensure grouped Heartbeat projection keeps the same invocation row and group identity when `tool_call` parameters hydrate during the running state.
- [x] 1.3 Add coverage for a running invocation that starts with empty args and later reveals parameters before `tool_result` arrives.

## 2. Heartbeat surface and transcript behavior

- [x] 2.1 Replace the custom footer context widget with the shared AI-elements `Context` trigger/content composition fed by objective runtime usage facts.
- [x] 2.2 Add a live elapsed-duration clock for running Heartbeat group headers that updates independently of new Heartbeat events and freezes on completion.
- [x] 2.3 Move the `Load older` affordance into a dedicated top-of-stream lane above the first group card and show a disabled loading treatment while older groups are pending.
- [x] 2.4 Restore correct first-load vs empty vs refreshing Heartbeat rendering so an unloaded stream is not mistaken for an empty ledger.
- [x] 2.5 Re-check grouped virtualizer measurement so disclosure changes and top pagination do not leave stale whitespace or overlap at the bottom of the transcript.

## 3. Runtime settings persistence

- [x] 3.1 Make the Heartbeat config save path format-aware so JSON-backed editable layers round-trip valid JSON instead of YAML-style text.
- [x] 3.2 Persist runtime model knobs under canonical top-level `ai.temperature`, `ai.topK`, `ai.maxToken`, and `ai.thinking` pointers instead of mutating `ai.providers.*`.
- [x] 3.3 Add focused tests for toggling thinking and saving runtime config from the Heartbeat panel against avatar-scoped settings layers.

## 4. Verification and walkthrough

- [x] 4.1 Add or update WebUI tests covering footer context rendering, running duration updates, and top-of-stream loading behavior.
- [x] 4.2 Add or update runtime/client tests covering grouped Heartbeat invalidation for running tool-call parameter hydration.
- [x] 4.3 Run a CLI-backed Heartbeat walkthrough, including a real or harnessed tool call, and verify running parameters, settings saves, and top pagination behavior end-to-end.

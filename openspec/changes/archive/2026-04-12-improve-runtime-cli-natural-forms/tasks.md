## 1. OpenSpec and law update

- [x] 1.1 Add delta specs for runtime CLI natural flag compatibility and shell help discoverability
- [x] 1.2 Confirm the change stays shell-layer only and does not mutate runtime API truth or attention completion law

## 2. Runtime implementation

- [x] 2.1 Extend `message read/send` parsing to accept common natural flag forms while preserving positional and stdin flows
- [x] 2.2 Extend `terminal write` parsing to accept `--input/--text` and add minimal `--help` output for touched commands
- [x] 2.3 Update runtime built-in skill text so the AI can discover both canonical and compatible command forms

## 3. Validation

- [x] 3.1 Add runtime CLI regression tests for named flags and `--help` short-circuit behavior
- [x] 3.2 Re-run targeted backend tests plus real AI room-terminal delivery validation and confirm the CLI no longer derails the flow

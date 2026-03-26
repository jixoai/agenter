## 1. Provider selection law

- [x] 1.1 Refactor settings/session-config resolution so `ai.activeProvider` follows `local > user > project > builtin` precedence while `ai.providers` still deep-merge.
- [x] 1.2 Add unit coverage proving a user-selected provider (for example `kimi`) is not silently replaced by a checked-in project `default` provider.
- [x] 1.3 Update any repository-local settings artifacts/tests that still assume project-level `activeProvider` should override the user.

## 2. Unresolved attention obligation

- [x] 2.1 Tighten runtime diagnostics so non-zero scores remain explicitly unresolved even when scheduler containment is `backoff` or `blocked`.
- [x] 2.2 Add regression coverage for provider/config failure paths so unresolved debt is published as diagnosable runtime state rather than looking like silent completion.
- [x] 2.3 Re-run real-provider validation to prove solvable attention debt progresses with the resolved provider instead of falling back to disabled default behavior.

## 3. Verification

- [x] 3.1 Add/update tests for `resolveSessionConfig()` and runtime scheduler publication around unresolved scores.
- [x] 3.2 Capture one real session-story verification that proves the intended provider is selected and the unresolved message debt can converge.

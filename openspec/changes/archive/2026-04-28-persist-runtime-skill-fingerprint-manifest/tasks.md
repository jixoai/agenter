## 1. Durable Contract

- [x] 1.1 Add OpenSpec artifacts for the persisted runtime skill fingerprint manifest.
- [x] 1.2 Update durable specs to state that stopped-runtime skill changes are detected from the session-local manifest.

## 2. Runtime Implementation

- [x] 2.1 Add a type-safe manifest reader/writer with atomic temp-file replacement.
- [x] 2.2 Teach `RuntimeSkillSystem.refresh` to diff against the manifest when configured and reminders are enabled.
- [x] 2.3 Pass `sessionRoot/skill-system/fingerprint-map.json` from `SessionRuntime`.
- [x] 2.4 Preserve existing live watcher, polling, CLI, and attention ingress contracts.

## 3. Verification

- [x] 3.1 Add runtime skill tests for missing, corrupt, added, updated, removed, declared-file, and undeclared-file manifest behavior.
- [x] 3.2 Add session runtime integration coverage for a stopped-runtime skill edit becoming attention input after restart.
- [x] 3.3 Run targeted tests and typecheck.
- [x] 3.4 Perform the real stopped-runtime walkthrough and record evidence.

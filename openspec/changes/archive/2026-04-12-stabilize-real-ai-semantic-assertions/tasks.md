## 1. OpenSpec Alignment

- [x] 1.1 Record the redundant semantic judge and assertion-migration requirements in proposal/design/specs.
- [x] 1.2 Sync the durable backend spec summary once implementation stabilizes.

## 2. Generic Judge Hardening

- [x] 2.1 Add redundant multi-attempt execution and quorum resolution to the generic semantic judge primitives.
- [x] 2.2 Add diagnostics and fallback behavior for empty, malformed, or disagreeing judge outputs.
- [x] 2.3 Extend unit coverage for redundant quorum success and failure paths.

## 3. Targeted Helper and Scenario Migration

- [x] 3.1 Update targeted semantic helpers to preserve cheap pre-checks while delegating ambiguous cases to redundant generic judges.
- [x] 3.2 Replace brittle semantic string assertions in real-AI loopbus and room-terminal style scenarios with semantic-judge-backed checks or structured behavioral contracts.
- [x] 3.3 Add any reusable scenario-level helpers needed to wait for or validate semantic outcomes without hard-coded phrasing.

## 4. Verification

- [x] 4.1 Re-run semantic judge unit/provider tests.
- [x] 4.2 Re-run the affected real-AI integration suites against the configured global provider and confirm they pass end-to-end.
- [x] 4.3 Archive the change only after implementation, durable spec sync, and verification are complete.

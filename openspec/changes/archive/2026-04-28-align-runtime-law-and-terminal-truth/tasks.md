## 1. BDD Coverage

- [x] 1.1 Add terminal-system coverage proving admin group candidates persist through the canonical table and no longer mirror into terminal metadata.
- [x] 1.2 Add or update attention/session coverage proving current commits and session historian docs stay free of legacy egress semantics.

## 2. Runtime Law Cleanup

- [x] 2.1 Update durable project and app-server specs to replace current-law egress wording with Context+Items, dispatch/receipt, and explicit system mutation language.
- [x] 2.2 Add source comments to attention-system explaining Context+Items semantics.
- [x] 2.3 Add source comments to session-system explaining its AI-call historian role.

## 3. Terminal Truth Cleanup

- [x] 3.1 Remove terminal admin-group candidate mirroring from terminal metadata while preserving canonical admin candidate behavior.
- [x] 3.2 Verify public terminal control-plane behavior still returns correct admin failover state from the canonical table.

## 4. Verification

- [x] 4.1 Run OpenSpec validation for this change.
- [x] 4.2 Run targeted backend tests for terminal truth, attention/session law, message refs/revision guidance, runtime adapters, and delivery receipts.

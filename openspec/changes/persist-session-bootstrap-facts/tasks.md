## 1. Session ledger bootstrap fact

- [ ] 1.1 Update `SessionDb.savePromptWindow()` so empty prompt windows persist an explicit bootstrap state row.
- [ ] 1.2 Update prompt-window reconstruction helpers to ignore bootstrap-only rows when rebuilding prompt messages.
- [ ] 1.3 Update AI-call request message linkage to exclude bootstrap-only prompt-window rows.

## 2. Regression coverage

- [ ] 2.1 Add `@agenter/session-system` tests covering empty prompt-window persistence and reconstruction.
- [ ] 2.2 Add `@agenter/app-server` tests covering fresh started sessions so `session.db` contains a resolvable prompt-window bootstrap fact.

## 3. Durable spec sync

- [ ] 3.1 Sync the new bootstrap-fact rule into `openspec/specs/session-ai-call-ledger/spec.md`.
- [ ] 3.2 Sync the package-level durable summary into `packages/app-server/SPEC.md`.

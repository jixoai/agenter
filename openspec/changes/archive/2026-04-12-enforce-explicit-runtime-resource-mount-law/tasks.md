## 1. Runtime Boot Law

- [x] 1.1 Remove implicit workspace auto-attach and root grant injection from session create/start paths.
- [x] 1.2 Remove implicit default room ensure from runtime boot and room projection helpers.
- [x] 1.3 Remove implicit terminal auto-create and auto-focus from runtime boot defaults.

## 2. Recovery Composition

- [x] 2.1 Implement explicit recovery composition for room, terminal, and workspace attachments from durable system facts.
- [x] 2.2 Use attention context only as a recovery index / focus hint, not as a permission source.
- [x] 2.3 Ensure recovery skips revoked or detached resources instead of re-synthesizing fallback mounts.

## 3. Terminal Cwd Enforcement

- [x] 3.1 Change dynamic runtime terminal creation so omitted `cwd` resolves from explicit workspace mount context or fails clearly.
- [x] 3.2 Remove user-home fallback for AI-created runtime terminals and add diagnostics for missing or ambiguous mount context.

## 4. Harness And Verification

- [x] 4.1 Refactor real harness helpers and scenarios to explicitly mount/grant/focus rooms, terminals, and workspaces.
- [x] 4.2 Add automated tests for cold boot unattached state, stop/start recovery, and terminal `cwd` enforcement.
- [x] 4.3 Re-run the real multi-avatar project-room validation under the explicit mount law and record the result.

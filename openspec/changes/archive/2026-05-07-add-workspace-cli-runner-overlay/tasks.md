## 1. OpenSpec And Durable Contract

- [x] 1.1 Finalize this change's proposal, design, tasks, and delta specs for browser shell-dialog execution.
- [x] 1.2 Update durable docs (`SPEC.md` and affected package specs) so browser workspace exec surface routing becomes explicit platform law.

## 2. Backend Execution Truth

- [x] 2.1 Extend CLI catalog rows with `suggestedCommand` and browser execution surface metadata.
- [x] 2.2 Extend `workspace.exec` so browser calls can explicitly route to `root-workspace` or `public-workspace`.
- [x] 2.3 Expose one public root-shell execution method on `SessionRuntime` and return an explicit inactive-runtime shell failure instead of auto-starting root authority.

## 3. Client Runtime Facade

- [x] 3.1 Extend the typed client runtime-store workspace exec facade with the execution surface contract.

## 4. Workspace Shell Page

- [x] 4.1 Add focused shell-dialog controller helpers so terminal editing and history stay out of the route monolith.
- [x] 4.2 Add a dedicated Workspace shell dialog that opens from one selected command, auto-runs on open, and keeps later typed commands on the same backend shell surface.

## 5. Verification

- [x] 5.1 Add or update backend, client, and WebUI tests for catalog metadata, exec routing, shell-dialog open/auto-run, and inactive-runtime root shell-failure handling.
- [x] 5.2 Run targeted package verification for app-server, client-sdk, and WebUI after the change lands.

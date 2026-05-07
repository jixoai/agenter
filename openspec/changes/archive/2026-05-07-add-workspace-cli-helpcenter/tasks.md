## 1. OpenSpec And Durable Contract

- [x] 1.1 Finalize this change's proposal, design, tasks, and delta specs for the workspace CLI helpcenter and builtins visibility.
- [x] 1.2 Update durable docs (`SPEC.md` and affected package specs) so workspace CLI discovery and `helpcenter` become explicit platform law.

## 2. Backend Command Catalog

- [x] 2.1 Add a shared app-server command catalog model that projects just-bash builtins, runtime CLI commands, and workspace tool commands into grouped entries.
- [x] 2.2 Add workspace tool sidecar metadata parsing plus legacy fallback descriptions so browser and shell discovery stay objective.
- [x] 2.3 Add the shared `helpcenter` shell command for root-workspace and public-workspace shells.

## 3. Browser Query And Client Facade

- [x] 3.1 Add app-server/TRPC query surface for reading one workspace/avatar CLI catalog.
- [x] 3.2 Add typed client-sdk/runtime-store wrappers and tests for the new catalog contract.

## 4. Workspace CLI UI

- [x] 4.1 Add `CLI` to the Workspace workbench mode model, route state, and toolbar behavior.
- [x] 4.2 Render grouped command sections with search, builtins visibility, and compact/desktop-safe layout.

## 5. Verification

- [x] 5.1 Add or update backend, client, and WebUI tests for helpcenter, workspace tool metadata, and the new CLI mode.
- [x] 5.2 Run targeted package verification for app-server, client-sdk, and WebUI after the change lands.

## 1. Storage Law

- [x] 1.1 Replace global and workspace-private avatar path helpers with `by-principal` canonical roots plus `by-nickname` alias roots.
- [x] 1.2 Provision canonical principal roots and nickname symlinks when seat documents are initialized or written.
- [x] 1.3 Update workspace avatar catalog discovery and asset-root publication to read aliases but expose canonical paths.

## 2. Verification

- [x] 2.1 Add regression tests for global/workspace avatar root resolution and seat alias provisioning.
- [x] 2.2 Run app-server, avatar, and affected contract tests after the storage-law change.

## 3. Durable Spec Sync

- [x] 3.1 Update durable specs and backend integration notes to describe principal-keyed roots and nickname alias rules.

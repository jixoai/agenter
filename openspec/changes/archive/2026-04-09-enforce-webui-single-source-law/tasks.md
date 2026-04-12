## 1. Canonical asset-root law

- [x] 1.1 Add a canonical WebUI asset-root resolver for `agenter web` startup and remove silent dual-root selection
- [x] 1.2 Change CLI static serving to use only the resolved canonical root and fail fast when it is missing or invalid

## 2. Packaging and build flow cleanup

- [x] 2.1 Re-scope `packages/cli/assets/webui` as a derived packaging artifact rather than a workspace runtime truth
- [x] 2.2 Update build scripts and operator guidance so default verification uses the canonical WebUI build root

## 3. Verification

- [x] 3.1 Add CLI/integration coverage that verifies default `agenter web` serves the current WebUI build on `/`
- [x] 3.2 Add deep-link refresh coverage for `/messages/room/:chatId` and `/avatars/runtime/:sessionId/attention` through the default CLI entry

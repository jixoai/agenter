## 1. Identity Law

- [x] 1.1 Add OpenSpec deltas for principal-only room identifiers across message control plane and session projection

## 2. Platform Implementation

- [x] 2.1 Tighten `message-system` room creation to principal ids only and add breaking reset coverage for legacy room durability
- [x] 2.2 Persist `primaryRoomId` in session durability and bind it before session runtime start / session room reconstruction
- [x] 2.3 Inject async managed room-id allocation into `SessionRuntime.createMessageChannel()` and remove local `room-*` synthesis

## 3. Verification

- [x] 3.1 Run targeted `packages/message-system` and `packages/app-server` tests for principal room creation and session primary room binding
- [x] 3.2 Run targeted typecheck for touched packages
- [x] 3.3 Browser-verify that Messages no longer reintroduces new legacy `room-*` room tabs

## 1. Shared session resources

- [x] 1.1 Add lifecycle-owned message-channel resource state and `ensure` / `refresh` APIs in `packages/client-sdk`.
- [x] 1.2 Keep inflight refresh ownership off the route tree and attach it to session lifecycle handles.

## 2. Route adoption

- [x] 2.1 Update `Chats` route to consume the shared message-channel resource and remove route-local loading state.
- [x] 2.2 Update `SystemsPanel` to consume the same shared message-channel resource.
- [x] 2.3 Apply `ensure` semantics to other obvious workspace route resources that were reloading on entry.

## 3. Verification

- [x] 3.1 Add or update tests covering first-load vs warm-refresh behavior for chat channels.
- [x] 3.2 Verify workspace route switching no longer shows cold `Loading chat channels...` after the catalog is warm.

## 1. Shared Source Registry

- [x] 1.1 Add the shared attention source namespace registry and protocol-native `src` helpers in `packages/attention-system`.
- [x] 1.2 Refactor `packages/app-server/src/loopbus-plugin-runtime.ts` and related source adapter types to invalidate/read registry-backed `src` addresses instead of `systemId` / `subjectId` / `channelId`.
- [x] 1.3 Migrate attention commit provenance, projection helpers, and snapshot persistence to write/read `meta.src` as the shared durable source identity.

## 2. Notification Projection

- [x] 2.1 Refactor session notification projection to emit `src` plus registry-derived bucket data and remove message/terminal-specific shared fields.
- [x] 2.2 Replace message-specific notification consume APIs with protocol-native source cursor consumption in app-kernel, session-runtime, TRPC, and client-sdk.
- [x] 2.3 Move feature-specific unread derivation out of the shared notification contract and repair the affected runtime/WebUI selectors.

## 3. Web Chat View Identity Split

- [x] 3.1 Introduce a `web-chat-view` message model that uses `viewKey` for UI identity and explicit numeric `messageId` for durable room truth.
- [x] 3.2 Update shared transcript merge/visibility logic and host bindings to use `viewKey`, including visible-message callbacks and message actions.
- [x] 3.3 Repair message-system/WebUI mappings and shared web-chat-view tests/fixtures to the new identity model.

## 4. Verification

- [x] 4.1 Add or update backend integration tests for registry-backed source invalidation, notification projection, and notification consumption.
- [x] 4.2 Add or update `web-chat-view` and client/runtime-store tests for `viewKey` identity and protocol-native notification state.
- [x] 4.3 Run targeted typecheck and regression commands, then sync any durable spec wording that implementation uncovers.

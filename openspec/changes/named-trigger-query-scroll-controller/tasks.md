## 1. Shared Runtime

- [x] 1.1 Add the public `ScrollController + Named Trigger + Query + tx` contracts to `@agenter/svelte-components`.
- [x] 1.2 Implement base trigger families: visibility, resize, action, user input, and optional scroll metrics.
- [x] 1.3 Implement high-order trigger families: edge, overflow, collection delta, materialization, and insert batch.
- [x] 1.4 Wrap the existing anchored virtual list tx/arbitration kernel with the new named-trigger controller and program installation flow.
- [x] 1.5 Keep compatibility shims package-internal while removing business-path dependence on `request`, `notifyMutation`, and raw `transact`.

## 2. Shared Primitive Wiring

- [x] 2.1 Update `AnchoredVirtualList` to expose the new controller binding and query-driven scroll runtime.
- [x] 2.2 Publish insert-batch facts and other trigger inputs through the shared primitive instead of local viewport writers.
- [x] 2.3 Update shared Storybook capability labs to use installed programs rather than direct imperative scroll requests.

## 3. Consumer Migration

- [x] 3.1 Migrate `@agenter/web-chat-view` to named triggers plus a shared installed program for latest follow, older reveal, and return-to-latest.
- [x] 3.2 Migrate `VirtualConversation` and `Heartbeat` to the same controller model and remove semantic `scrollTop`/request ownership from feature code.
- [x] 3.3 Update supporting Storybook harnesses and perf harnesses to use the new controller surface.

## 4. Regression Proof

- [x] 4.1 Add unit coverage for each trigger family and the controller flush/arbitration model.
- [x] 4.2 Add Storybook DOM acceptance for the trigger playground, including query subtree inspection, active tx inspection, and interruption cases.
- [x] 4.3 Extend WebChat and Heartbeat Storybook DOM contracts to cover append while pinned, append while away, prepend near start, return-to-latest supersession, and user-input interruption.

## 5. Durable Spec Sync

- [x] 5.1 Sync anchored-scroll durable specs to the named trigger/query model.
- [x] 5.2 Sync package-level `SPEC.md` updates for the new public controller and trigger law.

## 1. Platform Contract

- [x] 1.1 Add the new `anchored-virtual-list-scroll` capability spec and align the proposal/design artifacts with the shared Web-scroll vocabulary.
- [x] 1.2 Update `scrollview-surface`, `svelte-components-platform`, and `web-chat-view` durable specs so standard `ScrollView` law is distinct from anchored virtual list scroll law.

## 2. Shared Package API

- [x] 2.1 Define the shared TypeScript contracts for targets, intents, requests, transactions, host adapters, and state snapshots in `@agenter/svelte-components` without introducing a separate scroll package.
- [x] 2.2 Implement a browser-first planner/driver that prefers edge and element semantics, while reserving position targets for reconcile-only cases.
- [x] 2.3 Model desktop + mobile user-input arbitration for direct manipulation, wheel, keyboard, and momentum, including source, priority, and interruption policy, while keeping native browser scrollbars as the baseline transport.
- [x] 2.4 Upgrade the public transaction API to a closure-based `transact(...)` surface with transaction-owned suspension points (`commit`, `settled`, semantic scroll helpers) and throw-on-abort semantics.

## 3. Consumer Adoption

- [x] 3.1 Migrate `@agenter/web-chat-view` transcript scroll ownership onto the new anchored virtual list contract.
- [x] 3.2 Migrate shared conversation consumers such as `VirtualConversation` / `Heartbeat` onto the same contract without route-local scroll math.
- [x] 3.3 Replace route-local latest / older reveal bookkeeping with coordinator requests plus host-side target materialization.
- [x] 3.4 Rebuild the shared Storybook capability lab around transaction closures so operators can manually trigger append-follow-latest and prepend-reveal-nearest-older flows from one surface.

## 4. Validation

- [x] 4.1 Add unit and DOM coverage for transaction interruption, current scroll target / eventual scroll position state, and virtualization materialization paths.
- [x] 4.2 Add Storybook DOM coverage for residual append/prepend jitter, near-latest auto-follow, and near-start auto-reveal under the new transaction closure API.

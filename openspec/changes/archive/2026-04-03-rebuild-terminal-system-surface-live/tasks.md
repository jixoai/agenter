## 1. Live Terminal Data Flow

- [x] 1.1 Add terminal live event subscriptions in app-server for catalog, snapshot, status, activity, grant, approval, and focus changes
- [x] 1.2 Normalize global terminal live state inside `RuntimeStore` and remove route-local polling ownership

## 2. Terminal Operator Surface

- [x] 2.1 Rebuild the Svelte `Terminals` route to render from store selectors and keep terminal transcript state after refresh
- [x] 2.2 Upgrade `Actions + Users` to reflect live tool-call actions, seat state, approvals, and access-management flows
- [x] 2.3 Align terminal access dialogs and `call as` behavior with the message-system operator UX

## 3. Verification

- [x] 3.1 Add Storybook DOM coverage for terminal sidebar interactions and access-management flows
- [x] 3.2 Add Playwright BDD coverage for create-terminal, write/read, grant-seat, approval, refresh, and mobile navigation behavior

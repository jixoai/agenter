## 1. Shared Chat Package

- [x] 1.1 Rebuild `@agenter/web-chat-view` as a Svelte custom element with the existing room transport contract
- [x] 1.2 Add package-level tests for connection, hydration, pending rows, visibility ordering, and long-history pagination

## 2. Live Room Data Flow

- [x] 2.1 Add room-level live event subscriptions in app-server and normalize them inside `RuntimeStore`
- [x] 2.2 Replace polling room state in the Svelte `Messages` route with subscription-backed store selectors

## 3. Operator Surface

- [x] 3.1 Rebuild the `Messages` route around the shared chat host plus a dedicated users/access sidebar
- [x] 3.2 Restore room management dialogs, send-as actor selection, grant flows, read progress, and seat focus behavior

## 4. Verification

- [x] 4.1 Add Storybook DOM coverage for the shared chat host and the operator room surface
- [x] 4.2 Add Playwright BDD coverage for create-room, send-message, grant-seat, and live transcript updates on desktop and iPhone 14

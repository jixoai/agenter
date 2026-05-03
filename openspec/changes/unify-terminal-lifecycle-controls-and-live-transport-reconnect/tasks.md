## 1. OpenSpec And Lifecycle Law

- [ ] 1.1 Add delta specs for `terminal-system-surface`, `terminal-view-component`, and `terminal-surface-projection` covering unified lifecycle ownership, kill confirmation, stable stopped transport discovery, and same-URL reconnect.
- [ ] 1.2 Document that bootstrap parameters remain part of durable terminal configuration rather than lifecycle button chrome.

## 2. Lifecycle And Transport Implementation

- [ ] 2.1 Unify `page-toolbar` and `terminal-window` lifecycle controls behind one route-owned lifecycle action handler.
- [ ] 2.2 Add kill confirmation before `stop` while keeping delete-terminal as a separate destructive route action.
- [ ] 2.3 Gate `terminal-view` live websocket transport with explicit lifecycle truth so `kill -> bootstrap` reconnects even when `transportUrl` does not change.
- [ ] 2.4 Align the terminal surface story harness with stable stopped transport discovery when a transport endpoint already exists.

## 3. Verification

- [ ] 3.1 Keep a terminal-view regression that proves reconnect after `liveTransportEnabled` flips `false -> true` on the same URL.
- [ ] 3.2 Keep Storybook regression coverage for kill confirmation and unified lifecycle controls.
- [ ] 3.3 Run targeted verification commands for terminal-view, WebUI layout/storybook, and Svelte type checking.

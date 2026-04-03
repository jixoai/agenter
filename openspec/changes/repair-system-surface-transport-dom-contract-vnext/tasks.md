## 1. Message transcript loading repair

- [x] 1.1 Add an explicit host-to-view signal that marks an empty room snapshot as already resolved.
- [x] 1.2 Update `web-chat-view` to stop showing the initial loading shell once an empty resolved snapshot is known.
- [x] 1.3 Add a regression test covering an empty room that should render its empty state before any websocket snapshot arrives.

## 2. Async surface DOM exclusivity

- [x] 2.1 Update the Svelte `AsyncSurface` wrapper so only the active state payload is rendered into light DOM.
- [x] 2.2 Verify the hidden empty/skeleton copy no longer leaks into WebUI system-surface DOM.

## 3. Terminal activity visible-title contract

- [x] 3.1 Update the shared terminal invocation card to render a distinct human-readable title when metadata provides one.
- [x] 3.2 Add a regression test covering the visible title plus raw tool id metadata.

## 4. Acceptance verification

- [x] 4.1 Run targeted shared-package tests and WebUI typecheck.
- [x] 4.2 Run WebUI DOM/E2E regression and desktop/mobile dogfooding against the repaired surfaces.

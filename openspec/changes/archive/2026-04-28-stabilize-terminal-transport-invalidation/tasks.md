## 1. Reproduction

- [x] 1.1 Add regressions that reproduce the stopped-terminal transport storm boundary in `terminal-system`, `app-server`, and `terminal-view`.

## 2. Implementation

- [x] 2.1 Restrict terminal websocket transport to one bootstrap snapshot plus geometry-meaningful snapshot refreshes.
- [x] 2.2 Narrow app-kernel terminal invalidation so `snapshot/status` no longer emit `catalogChanged`.
- [x] 2.3 Keep `terminal-view` from rehydrating redundant same-geometry live snapshots after live transport has taken over.

## 3. Verification

- [x] 3.1 Run targeted terminal regressions for `@agenter/terminal-system`, `@agenter/app-server`, and `@agenter/terminal-view`.
- [x] 3.2 Run a real browser walkthrough on a stopped terminal in desktop and mobile, and confirm the route loads without `terminal.globalList` request storms.
- [x] 3.3 Sync durable OpenSpec/package specs for the transport, invalidation, and renderer fallback laws before closing the fix.

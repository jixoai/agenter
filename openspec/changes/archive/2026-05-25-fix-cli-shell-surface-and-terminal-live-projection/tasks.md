## 1. BDD Contracts

- [x] 1.1 Add cli-shell tmux tests for `user|help` and `user|chat` status range normalization.
- [x] 1.2 Add cli-shell tmux tests proving Chat toggle closes popup/pane and layout moves the singleton without double-opening Room.
- [x] 1.3 Add terminal control/store tests proving live projection excludes killed and index/history ordering is live first then killed by killed time.
- [x] 1.4 Add Studio terminal route/workbench tests proving `/terminals` and live tabs ignore killed records while history/index remains reachable.

## 2. Cli-shell Surface State Machine

- [x] 2.1 Implement normalized tmux action parsing for status user ranges without accepting unknown payloads.
- [x] 2.2 Add generic `@agenter/tmux-client` and refactor `tmux-host` Chat runtime actions around one session-local singleton state: closed, popup, pane.
- [x] 2.3 Make status-bar Chat a real toggle that closes the current surface and restores shell focus/highlight.
- [x] 2.4 Make Room titlebar layout requests move the singleton surface and keep the current Room process close behavior deterministic.

## 3. Terminal Live/History Projection

- [x] 3.1 Add or expose a terminal index projection over canonical terminal instance records without creating a second history table.
- [x] 3.2 Ensure live projection APIs and client store caches cannot retain killed records in `globalTerminals`.
- [x] 3.3 Ensure history/index ordering is live first and killed records sorted by killed time descending.

## 4. Studio Route Integration

- [x] 4.1 Update terminal workbench tabs and `/terminals` redirect to use live-only projection.
- [x] 4.2 Update terminal history/index route to show live records first and killed records after them with clear lifecycle grouping/actions.
- [x] 4.3 Keep killed detail routes explicit history/archive projections instead of appearing as live detail tabs.

## 5. Verification

- [x] 5.1 Run OpenSpec strict validation for this change.
- [x] 5.2 Run targeted cli-shell tmux/room tests and generic tmux-client tests.
- [x] 5.3 Run targeted terminal-system/app-server/client-sdk projection tests.
- [x] 5.4 Run targeted Studio terminal route/workbench tests.

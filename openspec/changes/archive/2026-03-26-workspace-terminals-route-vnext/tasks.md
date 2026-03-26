## 1. Workspace shell route expansion

- [x] 1.1 Add a dedicated workspace `Terminals` route and navigation target alongside `Chats`, `Devtools`, and `Settings`.
- [x] 1.2 Rename shell-visible `Chat` labels to `Chats` where they describe the workspace route/tab.
- [x] 1.3 Keep route-local notices and actions owned by the route body instead of the top header.

## 2. Terminal surface reuse

- [x] 2.1 Reuse the existing `TerminalPanel` runtime wiring from the secondary tooling path for the standalone route.
- [x] 2.2 Keep terminal activity paging and runtime-terminal-contract consumption intact in the new route.
- [x] 2.3 Reduce or remove duplicated terminal entry logic from the old secondary panel path.

## 3. Verification

- [x] 3.1 Add or update stories/DOM tests covering the new `Chats / Terminals / Devtools / Settings` shell on desktop and compact viewports.
- [x] 3.2 Run targeted WebUI unit tests, DOM tests, and build for the navigation change.

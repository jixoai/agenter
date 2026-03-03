---
"@agenter/app-server": patch
"@agenter/client-sdk": patch
"@agenter/cli": patch
"@agenter/tui": patch
"@agenter/webui": patch
---

Rebuild the production UI stack with an engineering-first architecture:

- add `@agenter/client-sdk` as shared realtime/state layer for UI clients
- add app-server kernel + tRPC router foundations for session/chat/settings/runtime APIs
- migrate CLI web/daemon runtime to tRPC websocket server and static web asset hosting
- upgrade `@agenter/webui` to React + Vite app with Vitest and Playwright scaffolding
- refactor `@agenter/tui` into modular panels and shared view-model mapping
- add build pipeline to copy webui dist into CLI assets (`build:ui`)

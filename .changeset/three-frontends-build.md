---
"@agenter/app-server": patch
"@agenter/cli": patch
"@agenter/tui": patch
"@agenter/webui": patch
---

Introduce the first production skeleton for daemon-backed multi-instance runtime:

- add daemon server APIs and runtime/instance registry in `@agenter/app-server`
- add `agenter daemon|web|tui|doctor` command entry in `@agenter/cli`
- add OpenTUI websocket client package `@agenter/tui`
- add mobile-first websocket web client package `@agenter/webui`
- integrate Changesets workflow at workspace root for managed package versioning

---
"@agenter/app-server": patch
"@agenter/cli": patch
"@agenter/tui": patch
"@agenter/webui": patch
---

Align workspace tests to BDD-first high-value scenarios:

- migrate runtime and protocol tests to Feature/Scenario naming
- keep only high-signal e2e flows for CLI and daemon boundaries
- remove low-value smoke tests and add a stable TUI ws protocol contract test
- document testing scope and behavior-driven standards for future changes

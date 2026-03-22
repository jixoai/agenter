## 1. Renderer package definition

- [x] 1.1 Add OpenSpec proposal, design, and capability specs for the standalone terminal-view component
- [x] 1.2 Create a standalone `terminal-view` package and define its WebComponent contract
- [x] 1.3 Implement websocket PTY transport consumption and lifecycle handling inside the component

## 2. Layout and scroll behavior

- [x] 2.1 Define and implement explicit terminal viewport scroll ownership with visible scrollbar support
- [x] 2.2 Add DOM contract tests for terminal-view rendering, connection state, and scroll behavior
- [x] 2.3 Add browser walkthrough or integration coverage for embedded terminal scrolling in WebUI

## 3. WebUI integration

- [x] 3.1 Replace WebUI-local terminal renderer glue with the standalone terminal-view component
- [x] 3.2 Keep WebUI integration thin by passing transport/config data instead of renderer internals
- [x] 3.3 Verify the integrated surface on desktop and narrow viewport layouts before updating task status

## Execution Notes

- Do not start this change until websocket PTY transport and client-facing host contracts are both stable enough to embed.
- The renderer viewport must remain the only scroll owner for terminal content.
- Verification requires both DOM contract coverage and browser walkthrough evidence on narrow viewports.

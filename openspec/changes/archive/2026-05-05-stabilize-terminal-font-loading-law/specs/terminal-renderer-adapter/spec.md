## MODIFIED Requirements

### Requirement: Renderer stacks SHALL own presentation mapping

Renderer stack adapters SHALL map shared `theme + cursor + font` profile inputs into renderer-specific options or CSS variables inside the adapter boundary.

#### Scenario: Renderer font settlement waits for terminal-owned browser font preparation
- **WHEN** `ghostty-web` or `xterm` opens or applies a terminal font mutation
- **THEN** the adapter waits on the shared terminal font loader before remeasure or repaint
- **AND** the adapter does not assume the host already imported matching `@font-face` rules

#### Scenario: Browser evidence remains traceable to terminal-view
- **WHEN** a renderer settles an optional terminal webfont such as `JetBrains Mono`
- **THEN** the browser-visible font request originates from terminal-view-owned asset declaration
- **AND** `Resource Timing` evidence can be traced back to a terminal-view marker rather than host-global CSS privilege

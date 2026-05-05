## MODIFIED Requirements

### Requirement: Renderer stacks SHALL declare presentation mutation policy

Renderer stack adapters SHALL declare whether shared presentation fields can settle through `live-apply` or require `rebuild-session`, so host code never invents renderer-specific capability branches.

#### Scenario: Ghostty-web theme mutation requires rebuild
- **WHEN** `ghostty-web` receives a durable theme mutation after the renderer is already open
- **THEN** the adapter policy reports that theme settlement requires `rebuild-session`
- **AND** `terminal-view` does not pretend that host-local live-apply is authoritative

#### Scenario: Ghostty-web font mutation settles live
- **WHEN** `ghostty-web` receives a durable font mutation while the renderer session stays on `ghostty-web`
- **THEN** the adapter policy reports `live-apply`
- **AND** the adapter remeasures and repaints the renderer from the same terminal session instead of forcing a rebuild

#### Scenario: XTerm cursor mutation stays live
- **WHEN** `xterm` receives a cursor-style mutation while the terminal session stays on `xterm`
- **THEN** the adapter policy reports `live-apply`
- **AND** `terminal-view` keeps the same renderer session alive

#### Scenario: XTerm font mutation stays live
- **WHEN** `xterm` receives a durable font mutation while the terminal session stays on `xterm`
- **THEN** the adapter policy reports `live-apply`
- **AND** the adapter refreshes the existing renderer session after browser font readiness instead of forcing a rebuild

### Requirement: Renderer stacks SHALL own presentation mapping

Renderer stack adapters SHALL map shared `theme + cursor + font` profile inputs into renderer-specific options or CSS variables inside the adapter boundary.

#### Scenario: Xterm-like stack maps shared presentation profile locally
- **WHEN** `xterm` or `ghostty-web` is the resolved renderer
- **THEN** the adapter maps shared presentation fields into renderer-local options
- **AND** host surfaces do not duplicate renderer-specific presentation mapping

#### Scenario: Ghostty-web waits for browser font settlement
- **WHEN** `ghostty-web` opens or applies a new font family or size
- **THEN** the adapter waits for browser font readiness when available
- **AND** it remeasures and repaints the canvas using the configured shared font profile instead of leaving fallback-width metrics active
- **AND** unsupported shared font knobs such as line-height, letter-spacing, and weight do not become fake renderer option truth

#### Scenario: XTerm waits for browser font settlement
- **WHEN** `xterm` opens or applies a new font family or size
- **THEN** the adapter waits for browser font readiness when available
- **AND** it refreshes the existing terminal grid after font settlement so previously written rows do not keep fallback metrics

#### Scenario: WTerm stack maps shared presentation profile locally
- **WHEN** `wterm` is the resolved renderer
- **THEN** the adapter maps shared presentation fields into the `WTerm` host's CSS-variable contract
- **AND** feature code does not write renderer-specific CSS variables itself

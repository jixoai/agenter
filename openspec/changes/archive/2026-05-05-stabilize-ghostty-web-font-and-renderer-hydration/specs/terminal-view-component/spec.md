## MODIFIED Requirements

### Requirement: Terminal-view SHALL restore the current snapshot after renderer rebuild

When `terminal-view` rebuilds its local renderer stack, it SHALL restore the current snapshot truth into the fresh renderer session even if the snapshot sequence has not advanced.

#### Scenario: Rebuild does not leave the viewport blank
- **WHEN** a renderer mutation requires `rebuild-session`
- **AND** the current durable snapshot sequence stays unchanged
- **THEN** the fresh renderer session still hydrates from the current snapshot
- **AND** the visible viewport does not remain blank while waiting for future PTY output

#### Scenario: XTerm-to-ghostty-web swap repaints immediately
- **WHEN** the host changes renderer preference from `xterm` to `ghostty-web`
- **AND** the current durable snapshot already contains renderable terminal content
- **THEN** the rebuilt `ghostty-web` session paints that snapshot without requiring future PTY output
- **AND** the operator does not need to type another command just to reveal the old buffer

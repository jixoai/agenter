## MODIFIED Requirements

### Requirement: WebUI terminal and devtools surfaces SHALL consume the runtime terminal contract directly

WebUI terminal-facing surfaces SHALL render from global terminal ids, actor-scoped focused terminal sets, title/status metadata, and explicit terminal representation metadata instead of relying on legacy session-private or terminal-global focus assumptions.

#### Scenario: Terminal toolbar does not own collaboration focus
- **WHEN** the user is viewing the top-level `Terminals` page
- **THEN** the toolbar keeps terminal-local presentation controls only
- **THEN** actor focus or unfocus actions live in the terminal Users panel instead of a global toolbar button

#### Scenario: Users panel shows per-seat focus state
- **WHEN** the terminal page renders attached actors for a terminal
- **THEN** each actor row can display whether that seat currently focuses the terminal
- **THEN** explicit focus or unfocus actions act on that seat rather than on one shared terminal flag

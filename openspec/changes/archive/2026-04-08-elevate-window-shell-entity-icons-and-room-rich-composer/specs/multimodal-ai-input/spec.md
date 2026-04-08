## MODIFIED Requirements

### Requirement: Quick Start and Chat SHALL use one CodeMirror-based AI input
The WebUI SHALL provide a shared `AIInput` component backed by CodeMirror for Quick Start, session chat, and message-system rooms so that all three entry points behave consistently. That shared composer SHALL expose slash commands, workspace-path completion, attachment picking, drag/drop, screenshot capture affordances, and help/status hints from the same editing surface.

#### Scenario: Quick Start, session chat, and room chat share the same input semantics
- **WHEN** the user edits content in Quick Start, session chat, or a global room
- **THEN** all three surfaces use the same editor behavior, attachment model, and submit controls

#### Scenario: Slash commands stay inside the shared composer
- **WHEN** the user types `/` inside the shared composer
- **THEN** the same slash-command completion behavior is available from Quick Start, session chat, and room chat

### Requirement: AI input SHALL preserve explicit submit and draft behavior
The AI input SHALL submit on Enter, insert a newline on Shift+Enter, clear the draft after a successful send, and restore the previous draft state when a send fails.

#### Scenario: Enter submits the draft
- **WHEN** the user presses Enter with a sendable draft
- **THEN** the input submits the draft instead of inserting a newline

#### Scenario: Shift+Enter inserts a newline
- **WHEN** the user presses Shift+Enter while editing
- **THEN** the input keeps the draft in place and inserts a newline at the cursor

#### Scenario: Failed send restores the draft
- **WHEN** a submit attempt fails after the current draft was captured
- **THEN** the input restores the prior text and pending image attachments

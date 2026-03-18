## ADDED Requirements

### Requirement: Quick Start and Chat SHALL use one CodeMirror-based AI input
The WebUI SHALL provide a shared `AIInput` component backed by CodeMirror for both Quick Start and Chat so that both entry points behave consistently.

#### Scenario: Quick Start and Chat share the same input semantics
- **WHEN** the user edits content in Quick Start or Chat
- **THEN** both surfaces use the same editor behavior, attachment model, and submit controls

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

### Requirement: AI input SHALL resolve workspace paths before submission
The AI input SHALL offer completion for the current workspace when the active token starts with `@`, and it SHALL replace the token with a relative workspace path before the message is submitted.

#### Scenario: Choosing a completion removes the `@` marker
- **WHEN** the user chooses a completion candidate for an `@` token
- **THEN** the editor replaces the token with the candidate's relative workspace path text and does not keep the `@` prefix

#### Scenario: Path suggestions stay workspace-scoped
- **WHEN** the user requests `@` completion
- **THEN** the candidate list only contains files or directories from the current workspace scope

### Requirement: Image affordances SHALL be gated by provider capabilities
The WebUI SHALL only expose image attachment affordances when the resolved provider configuration reports image-input support for the current draft or session.

#### Scenario: Supported providers show image controls
- **WHEN** the resolved provider capabilities include image input support
- **THEN** Quick Start and Chat both show image attachment affordances

#### Scenario: Unsupported providers hide image controls
- **WHEN** the resolved provider capabilities do not include image input support
- **THEN** the image attachment affordances are not shown

### Requirement: Pending image attachments SHALL be previewable before send
The AI input SHALL show pending image thumbnails for selected, pasted, or dropped images, and each thumbnail SHALL open a preview dialog.

#### Scenario: Pasted or dropped images become pending attachments
- **WHEN** the user pastes or drops one or more images into the AI input
- **THEN** the input adds those images as pending attachments with visible previews

#### Scenario: Clicking a pending image opens the preview dialog
- **WHEN** the user activates a pending image thumbnail
- **THEN** the application opens a dialog that previews the full image

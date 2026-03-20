## Purpose

Define the shared multimodal AI input behavior for Quick Start and Chat in WebUI.
## Requirements
### Requirement: Quick Start and Chat SHALL use one CodeMirror-based AI input
The WebUI SHALL provide a shared `AIInput` component backed by CodeMirror for both Quick Start and Chat so that both entry points behave consistently. That shared composer SHALL expose slash commands, workspace-path completion, attachment picking, drag/drop, and screenshot capture affordances from the same editing surface.

#### Scenario: Quick Start and Chat share the same input semantics
- **WHEN** the user edits content in Quick Start or Chat
- **THEN** both surfaces use the same editor behavior, attachment model, and submit controls

#### Scenario: Slash commands stay inside the shared composer
- **WHEN** the user types `/` inside the shared composer
- **THEN** the same slash-command completion behavior is available from Quick Start and Chat

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

### Requirement: Image affordances SHALL remain available independently from provider image-input compatibility
The WebUI SHALL expose image attachment affordances whenever the session transport supports session asset uploads, even if the currently resolved provider configuration does not accept image input for model requests. When the current model cannot consume image input, the composer MUST surface compatibility feedback at send time instead of hiding attachment affordances.

#### Scenario: Image attachment UI remains available with transport support
- **WHEN** the current workspace/session can upload session assets
- **THEN** Quick Start and Chat both show image paste, drop, pick, and screenshot affordances
- **THEN** those affordances do not disappear solely because the current provider lacks image-input capability

#### Scenario: Incompatible image send shows clear feedback
- **WHEN** the user attempts to send a draft that includes image attachments while the current model does not accept image input
- **THEN** the composer shows a clear compatibility notice
- **THEN** the user is not forced to infer failure from missing attachment controls

### Requirement: Pending image attachments SHALL be previewable before send
The AI input SHALL show pending attachment previews for selected, pasted, or dropped assets, and each preview SHALL open a dialog appropriate for that asset kind.

#### Scenario: Pasted or dropped images become pending attachments
- **WHEN** the user pastes or drops one or more images into the AI input
- **THEN** the input adds those images as pending attachments with visible previews

#### Scenario: Picked video or file attachments become pending attachments
- **WHEN** the user selects one or more supported video or generic files through the picker or drag/drop flow
- **THEN** the input adds those assets as pending attachments with kind-appropriate preview affordances


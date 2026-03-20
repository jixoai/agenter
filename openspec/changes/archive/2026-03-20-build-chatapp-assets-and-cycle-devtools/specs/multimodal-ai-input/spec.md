## MODIFIED Requirements

### Requirement: Quick Start and Chat SHALL use one CodeMirror-based AI input
The WebUI SHALL provide a shared `AIInput` component backed by CodeMirror for both Quick Start and Chat so that both entry points behave consistently. That shared composer SHALL expose slash commands, workspace-path completion, attachment picking, drag/drop, and screenshot capture affordances from the same editing surface.

#### Scenario: Quick Start and Chat share the same input semantics
- **WHEN** the user edits content in Quick Start or Chat
- **THEN** both surfaces use the same editor behavior, attachment model, and submit controls

#### Scenario: Slash commands stay inside the shared composer
- **WHEN** the user types `/` inside the shared composer
- **THEN** the same slash-command completion behavior is available from Quick Start and Chat

### Requirement: Image affordances SHALL be gated by provider capabilities
The WebUI SHALL only expose image attachment affordances when the resolved provider configuration reports image-input support for the current draft or session. Generic file and video attachment affordances MAY remain available if the transport contract supports them, but screenshot capture MUST only create image attachments.

#### Scenario: Supported providers show image controls
- **WHEN** the resolved provider capabilities include image input support
- **THEN** Quick Start and Chat both show image attachment affordances

#### Scenario: Screenshot capture yields an image attachment
- **WHEN** the user runs the screenshot capture action and the browser grants screen-capture access
- **THEN** the composer adds a pending image attachment produced from the capture
- **THEN** the capture tracks are stopped immediately after the still image is created

### Requirement: Pending image attachments SHALL be previewable before send
The AI input SHALL show pending attachment previews for selected, pasted, or dropped assets, and each preview SHALL open a dialog appropriate for that asset kind.

#### Scenario: Pasted or dropped images become pending attachments
- **WHEN** the user pastes or drops one or more images into the AI input
- **THEN** the input adds those images as pending attachments with visible previews

#### Scenario: Picked video or file attachments become pending attachments
- **WHEN** the user selects one or more supported video or generic files through the picker or drag/drop flow
- **THEN** the input adds those assets as pending attachments with kind-appropriate preview affordances

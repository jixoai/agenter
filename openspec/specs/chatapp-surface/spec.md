# chatapp-surface Specification

## Purpose
TBD - created by archiving change build-chatapp-assets-and-cycle-devtools. Update Purpose after archive.
## Requirements
### Requirement: Workspace Chat SHALL use a reusable ChatApp surface
The WebUI SHALL provide a reusable ChatApp surface for workspace Chat that composes the message-bubble transcript viewport, avatar/icon rendering, attachment tray, preview affordances, restrained time dividers, per-message context menus, and the shared AI composer as independent project-local components.

#### Scenario: Chat route renders through the shared ChatApp surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the route renders the conversation viewport, attachment affordances, and composer through the shared ChatApp component set
- **THEN** the route does not rely on one monolithic chat component for all concerns

#### Scenario: Chat transcript exposes expert actions without leaking cycle UI
- **WHEN** the user opens a message-level menu or long-press action inside the ChatApp transcript
- **THEN** the transcript can expose copy and expert inspection actions for that message
- **THEN** the default bubble transcript still avoids visible cycle rows or cycle badges

### Requirement: ChatApp attachments SHALL render by asset kind
The ChatApp surface SHALL render stored message attachments according to their asset kind so users can distinguish images, videos, and generic files at a glance.

#### Scenario: Image attachment renders a thumbnail preview
- **WHEN** a message contains an image attachment
- **THEN** the chat surface shows an image thumbnail
- **THEN** activating the thumbnail opens a larger preview dialog

#### Scenario: Video attachment renders a video preview tile
- **WHEN** a message contains a video attachment
- **THEN** the chat surface shows a video preview tile with kind-specific affordance
- **THEN** activating the tile opens a dialog that can play the stored video

#### Scenario: File attachment renders a compact file card
- **WHEN** a message contains a generic file attachment
- **THEN** the chat surface shows a compact file card with file name, media type, and size

### Requirement: ChatApp composer SHALL expose slash and path shortcuts
The ChatApp composer SHALL expose slash-command completion and workspace-path completion without leaving the CodeMirror-based editing flow.

#### Scenario: Slash command completion opens from the composer
- **WHEN** the user types `/` at the start of a command token
- **THEN** the composer opens slash-command completion for supported commands such as `/compact`, `/start`, `/stop`, and `/screenshot`

#### Scenario: Path completion still works with the shared composer
- **WHEN** the user types an `@` workspace path token in the composer
- **THEN** the composer shows workspace-scoped path completions without losing the shared ChatApp interaction model

### Requirement: ChatApp composer SHALL support image-first media input
The ChatApp composer SHALL support image paste, drag/drop, picker-based upload, preview, and removal without leaving the CodeMirror-based input flow.

#### Scenario: User pastes or drops an image into Chat
- **WHEN** the user pastes or drops an image into the Chat composer
- **THEN** the composer adds that image to the pending attachment tray
- **THEN** the user can preview or remove it before sending


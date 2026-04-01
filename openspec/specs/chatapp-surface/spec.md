# chatapp-surface Specification

## Purpose
Define the reusable ChatApp composition contract for the workspace Chat route.
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
The ChatApp composer SHALL expose slash-command completion and workspace-path completion without leaving the CodeMirror-based editing flow, and it SHALL present its controls through a dual-row layout that separates actions from status/help content.

#### Scenario: Slash command completion opens from the composer
- **WHEN** the user types `/` at the start of a command token
- **THEN** the composer opens slash-command completion for supported commands such as `/compact`, `/start`, `/stop`, and `/screenshot`

#### Scenario: Path completion still works with the shared composer
- **WHEN** the user types an `@` workspace path token in the composer
- **THEN** the composer shows workspace-scoped path completions without losing the shared ChatApp interaction model

#### Scenario: Composer actions stay on one primary row
- **WHEN** the composer is rendered on desktop or compact widths
- **THEN** picker, screenshot, and send controls remain on one action row
- **THEN** helper and status content are rendered on a separate thinner row instead of mixing with the actions

#### Scenario: Secondary composer controls degrade before the primary send action
- **WHEN** the composer becomes too narrow to keep all secondary labels visible
- **THEN** helper content collapses into a `?` disclosure before action labels collapse
- **THEN** secondary actions may become icon-only while the send action remains visibly labeled

### Requirement: ChatApp composer SHALL support image-first media input
The ChatApp composer SHALL support image paste, drag/drop, picker-based upload, preview, and removal without leaving the CodeMirror-based input flow, and those local attachment states SHALL be surfaced through the thinner composer status region instead of a second oversized toolbar.

#### Scenario: User pastes or drops an image into Chat
- **WHEN** the user pastes or drops an image into the Chat composer
- **THEN** the composer adds that image to the pending attachment tray
- **THEN** the user can preview or remove it before sending

#### Scenario: Composer status row summarizes local attachment state
- **WHEN** the composer has pending local attachments or local compatibility notices
- **THEN** the thinner composer status row summarizes that local state without displacing the action row
- **THEN** the status row remains visually subordinate to the editor and send action

### Requirement: ChatApp metadata disclosure SHALL honor channel access role

The ChatApp metadata disclosure surface SHALL expose read-only channel facts for all valid roles and SHALL only expose metadata mutation or participant administration controls when the current channel access role is `admin`.

#### Scenario: Metadata disclosure does not own room focus
- **WHEN** the user opens room metadata from the Chats tab row
- **THEN** the disclosure shows room facts, metadata, participants, and grant administration
- **AND** it does not expose a room-global `Focus/Unfocus` action

### Requirement: ChatApp channel metadata SHALL use passive signal disclosure

The ChatApp surface SHALL expose channel metadata through a passive signal disclosure aligned with the channel tabs instead of dedicating a full metadata row above the transcript.

#### Scenario: Tabs remain inspection-only while Users panel owns seat focus
- **WHEN** the user inspects a room from the Chats page
- **THEN** the tab row is used to select which room is being viewed
- **AND** any focus or unfocus mutation is triggered from the Users panel for a specific seat token rather than from the tab chrome


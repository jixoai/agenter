## MODIFIED Requirements

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

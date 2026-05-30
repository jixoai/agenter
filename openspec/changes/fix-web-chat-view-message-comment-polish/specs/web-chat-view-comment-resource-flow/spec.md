## MODIFIED Requirements

### Requirement: Comment resources SHALL reopen into a dedicated comment detail stage

Comment resources rendered in the composer rail, the sent-message aggregated resource bar, or an inline comment token SHALL not reuse the generic file/image document stage. They SHALL reopen into a dedicated comment detail stage that preserves the selected-text anchor and the stored non-empty comment body, and under Framework7 runtime that detail stage SHALL live inside the same shared popup/page preview shell as image, file, and video resources. Empty comment bodies SHALL NOT be promoted into visible comment resources, placeholder comment cards, or `No comment body yet` transcript/detail copy.

#### Scenario: Opening a comment affordance defaults to view mode

- **WHEN** the operator opens a comment resource from a resource tile or inline token
- **THEN** the system opens one dedicated comment detail surface
- **AND** that surface starts in `view` mode
- **AND** it shows the stored selected-text context plus the stored comment content

#### Scenario: Empty comment body is absence of a comment resource

- **GIVEN** the operator has selected source text but has not saved a non-empty comment body
- **WHEN** the source line or resource shelf renders
- **THEN** no visible comment detail card is rendered for that empty body
- **AND** the UI does not show `No comment body yet`
- **AND** saving remains disabled until the draft contains non-empty content

#### Scenario: Comment anchor uses the canonical comment icon

- **WHEN** a visible comment anchor, comment detail badge, resource tile, or resource preview represents a comment resource
- **THEN** the visible comment glyph uses `MessageSquareDot`
- **AND** the anchor serial number styling may remain separately owned by the badge style contract

### Requirement: Comment detail SHALL support explicit view and edit modes

The shared comment detail surface SHALL support distinct `view` and `edit` modes so comment review and comment editing do not collapse into one oversized generic preview. Comment detail actions SHALL use semantic icon affordances with accessible labels for primary close, cancel, save, edit, view, comment, and action-menu controls; bare text-only links SHALL NOT be the primary action UI in Framework7 comment panels.

#### Scenario: View mode presents the stored comment without forcing edit state

- **WHEN** a comment detail surface is opened in `view` mode
- **THEN** the operator can read the selected-text context and non-empty comment content directly
- **AND** the surface uses the same shared preview shell as other resource previews under Framework7 runtime
- **AND** the surface does not force a textarea-first editing state

#### Scenario: Edit mode reuses the same comment detail surface

- **WHEN** the operator switches a comment detail surface into `edit`
- **THEN** the same component and shared preview shell present the editable comment body
- **AND** save/cancel controls remain within that same comment detail contract
- **AND** those controls expose icon affordances and accessible labels instead of relying on unadorned text links

### Requirement: Source-popup comment creation SHALL stay continuous with reopened comment review

Creating a comment from source inspection and reopening that comment later from a resource shelf SHALL preserve one continuous anchor model. The source popup SHALL only create/persist a comment resource after the operator saves non-empty comment text.

#### Scenario: Source-selected comment reopens with the same anchor summary

- **WHEN** the operator creates a comment from the source popup and later reopens it from a resource shelf
- **THEN** the reopened comment detail shows the same selected-text anchor summary captured at creation time
- **AND** the system does not lose the line/source context between creation and review

#### Scenario: Draft anchors do not become empty comments

- **WHEN** the operator opens a source-line comment editor and closes or cancels before saving non-empty text
- **THEN** the source popup does not leave behind a visible empty comment card
- **AND** later resource extraction does not expose that draft as a comment resource

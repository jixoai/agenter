# web-chat-view-comment-resource-flow Specification

## Purpose
Define the durable comment-resource continuity law for `web-chat-view`, including comment-resource reopen behavior, explicit comment detail modes, and continuity between source inspection and later comment review.
## Requirements
### Requirement: Comment resources SHALL reopen into a dedicated comment detail stage

Comment resources rendered in the composer rail, the sent-message aggregated resource bar, or an inline comment token SHALL not reuse the generic file/image document stage. They SHALL reopen into a dedicated comment detail stage that preserves the selected-text anchor and the stored comment body. For sent messages, the stored comment body and anchor SHALL be read from the raw Markdown footnote definition in `message.content`, not from `metadata.webChatCommentResources` or another backend WebChat sidecar. Under Framework7 runtime that detail stage SHALL live inside the same shared popup/page preview shell as image, file, and video resources.

#### Scenario: Opening a comment affordance defaults to view mode

- **WHEN** the operator opens a comment resource from a resource tile or inline token
- **THEN** the system opens one dedicated comment detail surface
- **AND** that surface starts in `view` mode
- **AND** it shows the stored selected-text context plus the stored comment content
- **AND** for sent messages those facts are reconstructed from the Markdown footnote definition in `message.content`

#### Scenario: Pure Markdown comment resource reopens after reload

- **GIVEN** a reloaded room message contains `[^Comment N]` plus a matching `[^Comment N]: ...` definition in raw Markdown content
- **AND** the message metadata contains no WebChat resource projection payload
- **WHEN** the operator opens the comment token or resource tile
- **THEN** the dedicated comment detail stage shows the comment body and anchor context from that Markdown definition

### Requirement: Comment detail SHALL support explicit view and edit modes

The shared comment detail surface SHALL support distinct `view` and `edit` modes so comment review and comment editing do not collapse into one oversized generic preview.

#### Scenario: View mode presents the stored comment without forcing edit state

- **WHEN** a comment detail surface is opened in `view` mode
- **THEN** the operator can read the selected-text context and comment content directly
- **AND** the surface uses the same shared preview shell as other resource previews under Framework7 runtime
- **AND** the surface does not force a textarea-first editing state

#### Scenario: Edit mode reuses the same comment detail surface

- **WHEN** the operator switches a comment detail surface into `edit`
- **THEN** the same component and shared preview shell present the editable comment body
- **AND** save/cancel controls remain within that same comment detail contract

### Requirement: Source-popup comment creation SHALL stay continuous with reopened comment review

Creating a comment from source inspection and reopening that comment later from a resource shelf SHALL preserve one continuous anchor model. Saving a source-popup comment SHALL create a frontend pending comment resource only until send; before persistence, the send path SHALL serialize that resource into the raw Markdown message content as an inline token plus footnote definition. Reopened comment review SHALL therefore depend on Markdown source continuity, not hidden metadata continuity.

#### Scenario: Source-selected comment reopens with the same anchor summary

- **WHEN** the operator creates a comment from the source popup and later reopens it from a resource shelf
- **THEN** the reopened comment detail shows the same selected-text anchor summary captured at creation time
- **AND** the system does not lose the line/source context between creation and review
- **AND** after room send, that continuity is recoverable from `message.content` alone

#### Scenario: Comment send converts pending state into Markdown storage

- **GIVEN** a source-popup comment has a non-empty body and selected-text anchor
- **WHEN** the operator sends the message that references that comment
- **THEN** the pending comment resource is serialized into a Markdown footnote definition in the outgoing content
- **AND** no `webChatCommentResources` metadata is emitted as a storage carrier

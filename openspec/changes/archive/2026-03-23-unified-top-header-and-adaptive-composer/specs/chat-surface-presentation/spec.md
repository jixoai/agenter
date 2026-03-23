## MODIFIED Requirements

### Requirement: Workspace Chat SHALL present a conversation-first session stage
The WebUI SHALL render the workspace Chat route as a conversation-first stage that prioritizes user messages, assistant replies, avatars, restrained time dividers, attachment previews, and the shared AI input composer over cycle or kernel inspection details.

#### Scenario: Active session opens on a conversation-focused surface
- **WHEN** the user opens a workspace Chat route with an active session
- **THEN** the primary visible surface is the conversation stream plus the shared AI input composer
- **THEN** workspace chrome remains visually secondary to the conversation stage

#### Scenario: Conversation-first chat still supports rich attachments
- **WHEN** messages contain persisted image, video, or file attachments
- **THEN** the Chat route keeps the conversation-first reading order
- **THEN** those attachments are rendered inline without turning the chat stream into a cycle-inspection view

#### Scenario: Conversation flow uses restrained time dividers
- **WHEN** adjacent chat messages are separated by a meaningful time gap or a date boundary
- **THEN** the Chat route inserts a centered time or date divider into the transcript
- **THEN** the divider stays visually secondary to the message bubbles

### Requirement: Composer helper content SHALL collapse before primary actions degrade
The shared Chat composer SHALL use adaptive affordances so helper copy collapses into a secondary help affordance before primary actions lose their semantic prominence.

#### Scenario: Helper hints collapse into a rich tooltip
- **WHEN** the composer container becomes too narrow to keep all helper chips visible
- **THEN** the helper content collapses into a `?` affordance that opens a rich tooltip or popover
- **THEN** the send flow remains visible without helper text noise

#### Scenario: Secondary attachment controls become icon-only when needed
- **WHEN** the composer container remains narrow after helper collapse
- **THEN** attachment and screenshot controls may hide their labels while keeping icon-only buttons
- **THEN** the primary send action still remains clearly identifiable

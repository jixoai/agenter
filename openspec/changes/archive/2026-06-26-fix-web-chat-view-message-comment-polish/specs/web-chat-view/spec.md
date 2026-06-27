## MODIFIED Requirements

### Requirement: Web chat view SHALL render canonical avatar and message action affordances
The shared chat package SHALL support canonical avatar/icon resolution for room and contact identity, and it SHALL expose local hover/context message action affordances from the shared message row implementation. The package SHALL own the CSS geometry for transcript avatars, fallback initials, icon wrappers, images, message-local row controls, and read-progress indicators so that hosts can embed the component without generating package-internal Tailwind utility classes. Natural image dimensions, forwarded classes on external component roots, host utility-class availability, or Studio route chrome SHALL NOT determine transcript avatar, read-indicator, or action-affordance size. Visible message sender presentation SHALL resolve from durable sender/contact identity first and only use message `from` or access-control labels as fallback text; access-token provenance such as a trusted bootstrap grant SHALL NOT be presented as the normal human sender when a canonical sender/contact can be resolved.

#### Scenario: Host resolves canonical avatars
- **WHEN** the host or app-view room snapshot provides canonical icon or avatar URLs for the channel or participants
- **THEN** the shared message rows render those canonical avatars in transcript presentation
- **THEN** the chat package does not guess durable identity solely from visible labels

#### Scenario: Embedded avatar geometry stays package-owned

- **GIVEN** Studio embeds the Web Chat app-view room mode
- **AND** contact presentations include image or icon URLs with arbitrary natural dimensions
- **WHEN** the transcript renders message rows
- **THEN** each transcript avatar is clipped inside the shared chat avatar geometry
- **AND** the avatar bounding box stays within normal chat-row dimensions
- **AND** the host does not need a Studio-only `.message-avatar` emergency patch
- **AND** the result does not depend on the host generating Tailwind utility CSS for `@agenter/web-chat-view`

#### Scenario: Human-facing transcript identity does not leak raw contact ids by default
- **WHEN** the host resolves a participant presentation with canonical label, subtitle, and avatar facts
- **THEN** the transcript prioritizes the human-facing presentation in the visible row chrome
- **THEN** raw contact ids are not required to render as visible primary transcript text

#### Scenario: Trusted bootstrap label does not replace sender presentation
- **GIVEN** a room snapshot contains a message created through a bootstrap or admin grant
- **AND** the message has a canonical `senderContactId` or the snapshot provides a canonical presentation for the sender
- **WHEN** app-view renders the transcript
- **THEN** the visible sender label comes from the canonical sender/contact presentation
- **AND** `Trusted bootstrap` is not shown as the normal sender name
- **AND** bootstrap/admin grant labels remain access provenance rather than author identity

#### Scenario: App-view room mode receives self-sufficient actor presentation
- **WHEN** app-view runs in partial room mode inside Studio
- **THEN** it can construct or fetch an actor directory containing `actorId`, label, kind, and `iconUrl` for room senders visible in the snapshot
- **AND** the iframe does not import Studio runtime stores or depend on a Studio event bridge for normal sender/avatar presentation

#### Scenario: Shared row exposes local message actions without wrong-side compact padding
- **WHEN** the operator hovers, focuses, or context-clicks a transcript row
- **THEN** the row reveals the shared local message action affordance
- **AND** host routes can extend those actions without replacing the shared row renderer
- **AND** compact row styling does not reserve an unconditional `padding-inline-end` space that visually behaves like wrong-side padding for both sent and received bubbles
- **AND** action placement is expressed by explicit row ownership or overlay geometry rather than assuming document direction equals bubble direction

#### Scenario: Embedded read indicators stay package-owned

- **GIVEN** Studio embeds app-view and supplies read/unread contact projections for transcript messages
- **WHEN** a message row renders a discloseable read-progress trigger
- **THEN** the read indicator and its SVG ring are bounded to normal inline affordance dimensions
- **AND** the sizing rule works even when the trigger root is rendered by a Framework7 component
- **AND** the host does not need a Studio-only `.message-read-indicator` emergency patch

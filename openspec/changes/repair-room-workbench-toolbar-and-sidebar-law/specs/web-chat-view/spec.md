## MODIFIED Requirements

### Requirement: Web chat view SHALL present a conversation-first shared surface

The shared room component SHALL keep `messages_list` and `message_toolbar` as the only stage regions inside host-provided `page_content`. The transcript list SHALL own scrolling, the composer toolbar SHALL stay pinned to the bottom of the stage, and host toolbar chrome SHALL not intrude into the shared chat stage.

#### Scenario: Transcript owns the only scrolling region
- **WHEN** the room transcript exceeds the available height
- **THEN** only `messages_list` scrolls
- **AND** page wrappers do not introduce a second visible scroll region around the selected room

#### Scenario: Pinned composer survives compact viewports
- **WHEN** the shared chat stage is rendered in a compact viewport
- **THEN** the composer remains pinned to the bottom of the stage below the transcript list
- **AND** the stage does not allow toolbar chrome or tabs to cover the composer or message rows

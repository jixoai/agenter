## MODIFIED Requirements

### Requirement: Web chat view SHALL own transcript scrolling through ScrollView

The shared chat component SHALL delegate transcript scrolling to the shared anchored virtual list scroll contract instead of feature-local raw overflow ownership or generic `ScrollView` semantics, even when delivered as a reusable custom element. Inside host-provided `page_content`, the chat stage SHALL keep `messages_list` as the only transcript scroll owner and `message_toolbar` pinned to the stage bottom.

#### Scenario: Transcript uses the shared anchored virtual list scroll law

- **WHEN** the chat transcript exceeds the visible height
- **THEN** the component scrolls through the shared anchored virtual list scroll contract
- **THEN** host surfaces do not need to wrap the transcript in a second competing scroll owner

#### Scenario: Composer stays pinned while transcript scrolls

- **WHEN** the transcript grows beyond the available room stage height
- **THEN** only `messages_list` scrolls
- **THEN** the composer stays pinned at the bottom of the shared chat stage instead of entering a second page-level scroll region

#### Scenario: User input can interrupt programmatic transcript scrolling

- **WHEN** a programmatic transcript scroll is in progress
- **AND** the operator starts wheel, direct-manipulation, keyboard, or momentum-driven scrolling
- **THEN** transcript ownership follows the shared anchored virtual list interruption rules
- **AND** the component does not keep a private route-local scroll conflict state machine

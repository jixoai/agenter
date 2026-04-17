## ADDED Requirements

### Requirement: ScrollView virtual consumers SHALL preserve bottom anchors during measured growth

The shared `ScrollView` contract SHALL expose the virtualizer hooks needed by bottom-anchored consumers to keep the latest visible rows in view when a new measured item appears or when the last mounted item changes size after async disclosure or remeasurement.

#### Scenario: Appending a measured latest row keeps the bottom anchor

- **WHEN** a virtualized conversation is already pinned to the bottom
- **AND** a new latest row is appended and measured
- **THEN** the viewport remains anchored to the latest visible rows
- **AND** the consumer does not need a route-local second scroll container to recover the latest content

#### Scenario: Growing the last mounted row keeps the bottom anchor

- **WHEN** the last visible virtual row grows because more content becomes measurable after mount
- **THEN** the shared virtual scroll contract adjusts the viewport in place
- **AND** the latest visible rows remain reachable without manual operator scrolling

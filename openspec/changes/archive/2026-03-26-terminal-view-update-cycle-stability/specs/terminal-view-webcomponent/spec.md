## MODIFIED Requirements

### Requirement: terminal-view SHALL mount and hydrate without redundant Lit update-cycle warnings
The terminal-view WebComponent and its first-party React host SHALL render terminal snapshots and live transport state without triggering Lit's `change-in-update` warning in the real browser path.

#### Scenario: Snapshot-backed terminal story renders in the browser
- **GIVEN** the terminal Storybook surface mounts a snapshot-backed `terminal-view`
- **WHEN** the browser renders the terminal panel and hydrates the embedded terminal surface
- **THEN** the terminal still shows the expected scroll contract, fit/cover controls, and hydrated terminal output
- **THEN** the browser console does not receive a Lit `change-in-update` warning for `terminal-view`

#### Scenario: Live transport terminal updates after mount
- **GIVEN** a transport-backed `terminal-view` is already mounted
- **WHEN** transport lifecycle and output events arrive
- **THEN** the terminal reflects connection state and output updates
- **THEN** those updates do not introduce a Lit `change-in-update` warning

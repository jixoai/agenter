## MODIFIED Requirements

### Requirement: Client runtime store SHALL track reverse-time paging state per long-history resource

The client runtime store SHALL maintain explicit reverse-time page state for each long-history global resource and each long-history running-avatar detail resource, and SHALL hydrate only recent windows by default.

#### Scenario: Deep grouped Heartbeat hydration settles explicitly

- **WHEN** grouped Heartbeat hydration runs for a session with deep persisted history
- **THEN** the cached grouped resource settles to loaded-with-data, loaded-empty, or error explicitly once the grouped page request settles
- **AND** the store does not leave Heartbeat in a permanent loading state just because the grouped query path is expensive

#### Scenario: Grouped Heartbeat refresh keeps warm data while the next page settles

- **WHEN** a realtime invalidation or route refresh triggers a new grouped Heartbeat fetch for a session that already has visible groups
- **THEN** the store preserves the existing grouped rows during the refresh
- **AND** it marks the resource as refreshing until the new request settles
- **AND** a failed refresh surfaces an explicit error instead of dropping back to cold loading

#### Scenario: Heartbeat shell hydration avoids unrelated heavy history

- **WHEN** the runtime shell hydrates a Heartbeat route for one session
- **THEN** the client runtime store skips transcript history and unrelated devtools timelines during that cold start
- **AND** it only hydrates the Heartbeat-owned grouped resource, the minimal model-call window, and the route-owned notification/channel facts

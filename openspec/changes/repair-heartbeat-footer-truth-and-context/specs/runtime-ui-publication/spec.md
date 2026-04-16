## ADDED Requirements

### Requirement: Runtime clients SHALL publish grouped Heartbeat resource state explicitly

The runtime client SHALL expose grouped Heartbeat inspection data as a cached resource with explicit `loaded`, `loading`, `refreshing`, `error`, and `data` facts. Grouped Heartbeat consumers SHALL no longer infer load state from whether the current page array happens to be empty.

#### Scenario: Cold grouped Heartbeat hydration carries explicit load state
- **WHEN** a session runtime is hydrated from a cold browser state
- **THEN** the grouped Heartbeat slice starts in an unloaded/loading state
- **AND** it transitions to loaded-empty, loaded-with-data, or error explicitly after the grouped page request settles

#### Scenario: Realtime invalidation refreshes the grouped resource without dropping warm data
- **WHEN** a realtime Heartbeat invalidation refreshes an already loaded grouped slice
- **THEN** the runtime client marks the grouped Heartbeat resource as refreshing
- **AND** it preserves the currently loaded grouped rows until fresher grouped data arrives or the refresh fails

### Requirement: Runtime publication SHALL expose a manual compact action path

Runtime UI consumers SHALL be able to request a manual compact cycle through the runtime control plane without constructing transcript content to do so.

#### Scenario: UI requests a manual compact cycle
- **WHEN** a runtime UI consumer submits a manual compact request for one session
- **THEN** the runtime transport accepts that request through a formal control mutation
- **AND** the session runtime queues a manual compact cycle without requiring a chat-authored `/compact` message

## ADDED Requirements

### Requirement: Real cold restart recovery SHALL remain consistent with persisted runtime law
The runtime kernel SHALL remain operable after a real `session.stop` / `session.start` boundary using persisted session, room, workspace, and attention facts instead of hidden in-memory source state.

#### Scenario: Restarted runtime continues the same delivered task
- **WHEN** a real-provider validation flow stops a session after a room-visible delivery and later starts the same session again
- **THEN** the restarted runtime continues with the same session identity and durable room/workspace authority
- **AND** later user feedback can be resolved from persisted facts without relying on a hidden pre-stop runtime snapshot

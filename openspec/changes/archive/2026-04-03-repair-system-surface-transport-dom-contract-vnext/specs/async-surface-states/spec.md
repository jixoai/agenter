## MODIFIED Requirements

### Requirement: Shared async surface primitives SHALL be reused across workspace views
The WebUI SHALL provide shared async-surface primitives for fetch-driven application views so that `Quick Start`, `Workspaces`, `Sessions`, `Settings`, `Model`, `Terminal`, `Tasks`, `Process`, `LoopBus`, chat-channel lists, cycle history lists, and similar list-or-panel surfaces do not hand-roll incompatible loading shells. The shared async-surface primitive MUST model first-load, empty, and refreshing states without implicitly owning clipping, scrolling, or semantic background ownership.

#### Scenario: Inactive async-state copy does not leak into live DOM
- **WHEN** a surface is currently in one async state
- **THEN** only that state's payload is mounted into light DOM
- **THEN** inactive empty-state or skeleton copy does not remain queryable as hidden text alongside the active surface

## ADDED Requirements

### Requirement: Workbench open-tab projections SHALL remain device-local even when resources are durable

Workbench open-tab sets SHALL represent the current device's projection of what is open, not a globally unified tab strip. Durable resources such as chats, terminals, runtime sessions, or draft resources MAY sync independently, but each device SHALL choose its own open-tab projection.

#### Scenario: Desktop and mobile keep different tab strips for the same actor

- **WHEN** the same authenticated actor opens the application on desktop and mobile
- **THEN** each device may keep a different set and ordering of open workbench tabs
- **AND** syncing a durable resource on one device does not force the other device to mirror the same open-tab strip

#### Scenario: Closing a local draft tab does not delete the durable draft

- **WHEN** a workbench tab points at a durable draft resource and the operator closes that tab
- **THEN** the current device removes only the local tab projection
- **AND** the underlying draft resource remains durable until explicit discard or successful completion

## MODIFIED Requirements

### Requirement: Terminal-view SHALL consume websocket PTY transport

The component SHALL connect to the terminal-system websocket PTY transport contract and use that stream as its terminal data source. It SHALL also accept durable snapshot hydration from the host so the surface remains renderable while the live websocket is connecting or recovering.

#### Scenario: Stable transport URL reconnects after lifecycle restart
- **WHEN** the host keeps the same durable websocket URL but disables live transport because the terminal has stopped
- **THEN** the component moves to an idle live-transport state without discarding snapshot hydration
- **AND** when the host re-enables live transport on that same URL after bootstrap, the component opens a fresh websocket connection instead of staying closed

#### Scenario: Snapshot stays renderable while live transport is disabled
- **WHEN** the host disables live transport for a stopped terminal that still has snapshot truth
- **THEN** the component keeps rendering the current snapshot viewport
- **AND** it does not require the host to clear transport discovery just to prevent stale live websocket activity

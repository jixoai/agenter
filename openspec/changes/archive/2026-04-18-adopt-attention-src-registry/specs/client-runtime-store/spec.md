## ADDED Requirements

### Requirement: Client runtime store SHALL keep notification projection protocol-native
The client runtime store SHALL preserve shared notification projection as protocol-native `src` plus bucket-based unread aggregates. It SHALL NOT normalize the shared notification contract into kernel-owned `unreadByChat` or `unreadByTerminal` maps.

#### Scenario: Store ingests mixed room and terminal notifications without shared source switches
- **WHEN** the client receives a notification snapshot containing unread items from `msg:` and `tty:` namespaces
- **THEN** it preserves each item's protocol-native `src` and bucket identity
- **THEN** the shared store contract keeps unread aggregates in a source-agnostic shape
- **THEN** feature selectors may derive room or terminal unread views without changing the shared store law

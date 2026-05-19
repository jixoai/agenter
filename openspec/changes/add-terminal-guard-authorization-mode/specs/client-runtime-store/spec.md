## ADDED Requirements

### Requirement: Client runtime store SHALL normalize Guard terminal authority

The client runtime store SHALL normalize terminal grants, access projections, call-as options, approval requests, and write leases using `guard` as the canonical approval-gated terminal role. It SHALL NOT expose `requester` as the durable client role after this breaking change.

#### Scenario: Guard grant remains canonical in terminal state
- **WHEN** the store hydrates global terminal grants or terminal surface projection data
- **THEN** guard seats are represented with role `guard`
- **THEN** selectors and call-as options do not rename them back to `requester`

#### Scenario: Guard approval refresh updates approval and lease state
- **WHEN** a guard write approval request is created, approved, denied, or expired
- **THEN** the store refreshes the terminal approval state for that terminal
- **THEN** approved leases are projected onto the matching guard seat without rebuilding local seat truth

#### Scenario: Old requester data is not durable client truth
- **WHEN** a local development store or fixture still contains the old `requester` role
- **THEN** implementation either migrates it once to `guard` or rejects/cleans it during local upgrade
- **THEN** public client APIs and tests use `guard` as the canonical role

### Requirement: Client runtime store SHALL not expose product delegation authority

The client runtime store SHALL remove product delegation list/create/revoke APIs from the active product-extension runtime surface for this change. Client code may still expose terminal-native approval and write lease projections, but it SHALL NOT expose product-owned write delegation as a second authorization truth.

#### Scenario: Product extension client omits delegation methods
- **WHEN** product code constructs the product-extension runtime client
- **THEN** the active client surface includes product descriptor/resource/assistant/attention operations
- **THEN** it does not include `listProductDelegations`, `createProductDelegation`, or `revokeProductDelegation` as supported current operations

#### Scenario: Terminal leases remain terminal-native client facts
- **WHEN** a guard write is approved
- **THEN** the client store projects the resulting terminal write lease from TerminalSystem approval state
- **THEN** it does not mirror that lease into a product delegation record

### Requirement: Client runtime store SHALL expose filtered terminal permission request subscriptions

The client runtime store SHALL expose a permission request subscription API that can retain all observable terminal requests or only requests for one terminal id. The API SHALL support global notification surfaces and terminal-view components without forcing either caller to hydrate unrelated terminal approval state.

#### Scenario: Global notification retains all permission requests
- **WHEN** WebUI starts a global terminal permission request subscription
- **THEN** the client receives permission request events for all terminals the authenticated actor may observe
- **THEN** the store can update notification/badge state without loading every terminal detail
- **THEN** the store does not receive unauthorized request previews and then hide them locally

#### Scenario: Terminal view retains one terminal's permission requests
- **WHEN** a terminal-view component renders terminal `T`
- **THEN** the client subscribes with `terminalId=T`
- **THEN** only permission request events for `T` are delivered to that component

#### Scenario: Coalesced request updates preserve one visible item
- **WHEN** TerminalSystem refreshes or reuses an equivalent pending permission request
- **THEN** the store updates the existing request record by request id
- **THEN** notification and terminal-view subscribers do not see duplicate pending items for the same request

#### Scenario: Subscription recovery does not recreate stale authority
- **WHEN** the client reconnects after transport loss
- **THEN** it may refresh currently pending requests for retained terminal filters
- **THEN** it does not revive requests that TerminalSystem has cleared because the live TerminalInstance died or rebootstrap replaced it

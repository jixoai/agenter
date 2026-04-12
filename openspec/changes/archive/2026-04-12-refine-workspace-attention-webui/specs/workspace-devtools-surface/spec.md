## MODIFIED Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL stop flattening deep technical inspection into the primary Avatar detail tab set. Avatar detail SHALL reserve its primary tabs for `Heartbeat`, `Attention`, and `Settings`, while deeper technical tooling is entered through secondary links or future dedicated surfaces.

#### Scenario: Primary runtime tabs stay focused on heartbeat and attention
- **WHEN** the user opens a running-avatar detail shell
- **THEN** the primary tab strip exposes `Heartbeat`, `Attention`, and `Settings`
- **THEN** the user does not have to navigate across `Cycles` or telemetry tabs before reaching the runtime's main working surfaces

#### Scenario: Deep technical tooling is no longer a first-class peer tab
- **WHEN** the operator needs low-level telemetry or similar future tooling
- **THEN** the runtime shell links to a secondary or future dedicated inspection surface
- **THEN** the primary Avatar detail shell remains focused on runtime work rather than an always-expanded devtools dashboard

## REMOVED Requirements

### Requirement: Devtools SHALL expose a cycle-oriented inspection view
**Reason**: round-by-round cycle inspection is no longer a primary Avatar detail responsibility after the runtime shell moved to `Heartbeat / Attention / Settings`.
**Migration**: expose future cycle drilling through secondary tooling surfaces or dedicated follow-up routes instead of primary runtime tabs.

### Requirement: Devtools SHALL keep technical panels independently operable
**Reason**: the always-present technical panel suite is being removed from the primary runtime shell.
**Migration**: if future dedicated tooling returns, it should define its own panel contract in a separate change rather than inheriting this old flattened shell.

### Requirement: Devtools long-history panels SHALL use the shared reverse-time loading model
**Reason**: the old devtools long-history panel set is no longer the primary runtime surface contract.
**Migration**: future technical tooling should reuse the shared reverse-time paging law where relevant, but it must re-enter through a dedicated capability instead of this removed primary-panel requirement.

### Requirement: Workspace Devtools SHALL adapt cycle detail presentation by viewport class
**Reason**: cycle detail is no longer a required primary Avatar detail panel.
**Migration**: any future cycle inspection surface should define its own responsive contract when it is reintroduced.

### Requirement: Workspace Devtools SHALL preserve route-local tab and panel ownership
**Reason**: the removed primary devtools panel set no longer owns the runtime shell's tab and panel composition.
**Migration**: future dedicated tooling surfaces should define their own scroll and chrome ownership explicitly.

### Requirement: Devtools SHALL reflect the published LoopBus runtime model
**Reason**: LoopBus publication remains important, but it is no longer surfaced through a mandatory primary devtools tab inside Avatar detail.
**Migration**: consume the published LoopBus contract from future secondary tooling instead of the primary runtime shell.

### Requirement: Devtools SHALL embed the standalone terminal renderer instead of owning terminal rendering internals
**Reason**: embedded terminal inspection is no longer part of the primary Avatar detail devtools contract.
**Migration**: keep terminal rendering owned by terminal-specific surfaces or future dedicated technical tooling.

### Requirement: Devtools SHALL preserve persisted cycle history across lifecycle changes
**Reason**: persisted cycle history is no longer a required primary Avatar detail view.
**Migration**: future cycle tooling can still rely on durable history, but it should define that behavior in a later dedicated change.

### Requirement: Cycle technical records SHALL render as merged tool traces
**Reason**: tool-trace-oriented cycle detail is no longer part of the primary Avatar detail contract.
**Migration**: future technical inspection can continue using merged invocation records, but it should be specified under a dedicated technical tooling capability.

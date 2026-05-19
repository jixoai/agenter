## MODIFIED Requirements

### Requirement: Terminal tool actions SHALL require an explicit acting actor

Terminal read/write or other tool-call actions initiated from the UI SHALL let the operator choose which auth-backed actor performs the action, and the route SHALL derive those actor options from the authoritative terminal surface projection rather than reconstructing them from multiple client-side sources. When the selected actor has `guard` authority and a write creates an approval request, the route SHALL surface the approval request as pending work rather than collapsing it into a generic failure.

#### Scenario: Tool call with actor selection
- **WHEN** the operator selects an actor and invokes a terminal tool action
- **THEN** the request is sent using that actor selection rather than an implicit global identity

#### Scenario: Call-as options come from one surface projection
- **WHEN** the terminal detail route renders or refreshes
- **THEN** the visible `call as` options come from the authoritative terminal surface projection
- **THEN** the route does not need to merge `access`, `grants`, and `actors` locally to reconstruct seat truth

#### Scenario: Guard write request surfaces pending approval
- **WHEN** the chosen actor has `guard` terminal authority and invokes a terminal write without an active write lease
- **THEN** the route requests terminal approval creation through the terminal authority
- **THEN** the UI surfaces the pending approval request id, requested input, and expiry
- **THEN** the write draft is not treated as successfully delivered to the PTY

#### Scenario: Actor authority missing
- **WHEN** the chosen actor lacks valid terminal authority
- **THEN** the UI surfaces the failure as a credential/access problem and does not silently fall back

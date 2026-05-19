## MODIFIED Requirements

### Requirement: Product hosting state SHALL remain separate from terminal authority

Products SHALL model hosting/managed state as product-owned attention facts. A product hosting fact may schedule or wake an Avatar for product work, but it SHALL NOT grant terminal write authority, mint a terminal write lease, create a permanent writer grant, or require TerminalSystem to know product-specific hosting semantics. Product resource binding APIs SHALL preserve `guard` terminal grants as approval-gated authority distinct from product hosting state.

#### Scenario: Managed toggle creates hosting attention only
- **WHEN** the user enables cli-shell managed/takeover mode
- **THEN** cli-shell commits positive hosting attention for the current product terminal and room
- **AND** the attention content names the product id, shell name, terminal id, room id, Avatar actor, enabling actor, and current objective
- **AND** no product write delegation, terminal write lease, or permanent writer grant is created only because hosting was enabled

#### Scenario: Managed toggle off settles hosting attention only
- **WHEN** the user disables cli-shell managed/takeover mode
- **AND** cli-shell commits a hosting attention update with `scores: {"hosting": 0}` and reason `user_disabled`
- **AND** unrelated terminal grants, room grants, guard approval requests, and terminal write leases remain governed only by TerminalSystem authority

#### Scenario: Autonomous terminal effects use terminal authority rather than hosting state
- **WHEN** the Avatar writes terminal input while cli-shell hosting attention is active
- **THEN** the terminal write is submitted with the Avatar actor identity
- **AND** the terminal activity record carries enough provenance to resolve the terminal-native grant, approval request, or write lease that authorized the write
- **AND** hosting attention is not used as the authorization source for that write
- **AND** superadmin bootstrap authority is not used as the hidden actor for autonomous terminal effects

#### Scenario: Product binding preserves Guard without product hosting authority
- **WHEN** a product binds a terminal resource with grant role `guard`
- **THEN** the extension runtime issues or reuses the terminal-native guard grant
- **THEN** that binding does not imply direct writer authority
- **THEN** later writes must still come from terminal-native writer authority, guard approval, or an active terminal write lease

### Requirement: Product delegation SHALL be removed from the current runtime contract

The product-extension runtime SHALL NOT expose `ProductDelegation` as a current public contract for cli-shell managed/takeover. Product write delegation is a mistaken middle authority between product hosting attention and TerminalSystem grants/approval/leases. This change SHALL remove the active product delegation schemas, app-server store/routes, client SDK methods, cli-shell managed dependencies, and canonical tests that treat product delegation as platform truth.

#### Scenario: Product runtime exposes no delegation authority
- **WHEN** a product client uses the product-extension runtime after this change
- **THEN** it can use descriptor, resource binding, assistant seed, and attention operations
- **THEN** it cannot create, list, or revoke a product write delegation as a terminal authorization source
- **THEN** terminal write authority remains owned by TerminalSystem

#### Scenario: Cli-shell managed does not depend on ProductDelegation
- **WHEN** cli-shell reads, enables, or disables managed/takeover mode
- **THEN** it queries and commits hosting attention only
- **THEN** it does not read active product delegations to decide whether managed mode is on
- **THEN** it does not create or revoke product delegations as part of managed mode

#### Scenario: Local ProductDelegation data can be deleted
- **WHEN** a local runtime root contains product delegation JSON data from earlier cli-shell experiments
- **THEN** the implementation may delete or ignore that file during this breaking cleanup
- **THEN** no migration is required because the file is not authorized durable platform truth

#### Scenario: Future delegation requires a separate platform change
- **WHEN** a future product needs reusable delegated autonomy
- **THEN** it must be proposed as a separate capability with a named authority owner and non-cli-shell acceptance scenarios
- **THEN** this change does not preserve the current ProductDelegation shape as that future contract

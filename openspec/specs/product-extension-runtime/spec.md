# product-extension-runtime Specification

## Purpose
Define the generic contracts ordinary-user products use to bind backend resources, initialize assistants, project attention, and manage delegated autonomy without polluting core runtime modules.

## Requirements

### Requirement: Core SHALL expose product-extension capabilities without importing product modules

Agenter core SHALL provide programmable extension contracts for ordinary-user products. Product packages such as `@agenter/cli-shell` SHALL consume those contracts from outside core modules. Core packages SHALL NOT import product implementation packages or branch on product-specific UI, grammar, layout, or local state.

#### Scenario: Product descriptor is data, not a core branch
- **WHEN** the core launcher handles a product command such as `shell`
- **THEN** it resolves a controlled product descriptor containing command name, package name, bin metadata, source policy, and capability hints
- **AND** the descriptor does not import `@agenter/cli-shell` implementation code
- **AND** product-specific grammar such as optional `@avatar`, default `shell-assistant`, `--session`, or `shell-1` is parsed by the product package, not by core runtime modules

#### Scenario: Core remains product-agnostic after cli-shell is removed
- **WHEN** the `@agenter/cli-shell` package is absent or disabled
- **THEN** core terminal, room, AvatarRuntime, attention, and daemon modules remain valid
- **AND** no core module requires cli-shell UI state, toolbar state, terminal-grid layout, or session-name normalization to start

#### Scenario: Product consumes runtime through daemon or client SDK
- **WHEN** cli-shell runs as a local workspace package during tests or as a published package for users
- **THEN** it consumes product-extension capabilities through daemon/client-sdk style contracts
- **AND** it does not import core runtime internals merely because the package is colocated in the monorepo
- **AND** the same contract boundary remains visible when cli-shell is removed or published independently

#### Scenario: Future products reuse the same extension law
- **WHEN** another first-party product is added later
- **THEN** it can declare a product descriptor and consume the same launch, resource binding, assistant initialization, attention, and delegation APIs
- **AND** core does not need a new product-specific runtime branch equivalent to `if product is cli-shell`

### Requirement: Product extensions SHALL initialize assistant resources through generic APIs

The extension runtime SHALL let products ensure Avatar, prompt-source, and avatar-private memory resources through generic Avatar and WorkspaceSystem APIs. Product packages SHALL provide product defaults, but core runtime modules SHALL remain product-agnostic and prompt/memory files SHALL remain openly editable user assets.

#### Scenario: Extension ensures default assistant without core special case
- **WHEN** cli-shell needs default Avatar `shell-assistant`
- **THEN** it requests Avatar ensure through a generic Avatar/product-extension API
- **AND** it may create missing product-owned prompt and memory defaults through generic prompt/workspace resource APIs
- **AND** core launcher modules do not hard-code the `shell-assistant` nickname

#### Scenario: Extension prompt initialization stays open and seed-if-missing
- **GIVEN** product-owned default prompt or memory resources already exist for an Avatar
- **WHEN** cli-shell runs its initialization flow
- **THEN** it reads the existing files as current truth
- **AND** it creates missing resources without locking or automatically restoring product defaults over user edits
- **AND** advanced users may edit those resources manually

### Requirement: Product extensions SHALL bind backend resources through generic product-owned keys

The extension runtime SHALL expose generic APIs that let a product ensure or look up backend resources through the resource owner's control plane. Product packages SHALL provide `productId` and product-local `resourceKey` values, while the owning systems remain the only authorities for terminal, room, AvatarRuntime, and attention truth.

#### Scenario: Extension ensures a terminal through product namespace
- **WHEN** cli-shell wants the internal terminal for `--session=1`
- **THEN** it computes product-owned key `shell-1`
- **AND** it calls a generic product resource binding API with `productId=cli-shell`, `resourceKey=shell-1`, and resource kind `terminal`
- **AND** the terminal is still created, configured, granted, focused, read, and written through `terminal-system`
- **AND** core resource binding does not hard-code the `shell-1` naming rule

#### Scenario: Extension ensures a room through product namespace
- **WHEN** cli-shell wants the product room for `shell-1`
- **THEN** it calls a generic product resource binding API with `productId=cli-shell`, `resourceKey=shell-1`, and resource kind `room`
- **AND** the durable room id is allocated by `message-system`
- **AND** product metadata links the room to the product resource key without making the key the room id

#### Scenario: Extension binds default Avatar focus without multiplying runtime identity
- **WHEN** cli-shell binds a terminal and room without an explicit `@avatar` mention
- **THEN** it attaches those resources to the existing AvatarRuntime identity for Avatar `shell-assistant`
- **AND** it does not create a product-session-specific runtime identity
- **AND** focus and grants stay in the owning systems' native authority models

#### Scenario: Extension preserves explicit Avatar override
- **WHEN** cli-shell binds a terminal and room for explicit Avatar `default`
- **THEN** it attaches those resources to the existing AvatarRuntime identity for Avatar `default`
- **AND** the extension runtime does not replace the explicit Avatar with the product default

### Requirement: Product extensions SHALL use attention as their scheduling and projection surface

The extension runtime SHALL let products publish product-scoped attention facts and consume Heartbeat projections without hidden product prompt glue. The model-visible content SHALL be attention body or typed tool/query output; product metadata SHALL remain scheduler/provenance information.

#### Scenario: Product status is an attention projection
- **WHEN** cli-shell renders the toolbar Heartbeat text
- **THEN** it reads the latest visible Heartbeat message-part projection
- **AND** it may compact terminal/message/attention tool activity for display
- **AND** it does not create a second toolbar-owned event log as truth

#### Scenario: Product ingress creates attention, not kernel branches
- **WHEN** cli-shell observes product-relevant facts such as unread room messages, terminal idle-ready state, or delegation status changes
- **THEN** it expresses required AI follow-up through product-scoped attention contexts or items
- **AND** LoopBus scheduling consumes those attention facts through the normal attention law
- **AND** the kernel does not gain cli-shell-specific scheduling rules

#### Scenario: Managed mode creates hosting attention
- **WHEN** cli-shell managed mode is enabled
- **THEN** the product commits a product-scoped AttentionItem with the literal fixed score key `scores: {"hosting": 1000}`
- **AND** the item body carries the active hosting objective and product resource context
- **AND** the score remains positive until the Avatar or user settles it through normal attention commit law

#### Scenario: Product metadata stays projection-safe
- **WHEN** a product-scoped attention item references product state
- **THEN** product id, resource key, terminal id, room id, delegation id, and hosting memory role ids may appear as provenance metadata
- **AND** AI-visible instructions or obligations appear in the attention body
- **AND** metadata does not become a hidden side channel for product behavior

### Requirement: Product extensions SHALL expose minimal programmable attention-cli compatible operations for self-evolution

The extension runtime SHALL expose enough generic attention operations for products, skills, and assistants to compose self-evolution loops without adding named kernel features. In this change, the required minimum is commit, query, and settle. Richer watch or schedule primitives are deferred to a separate change.

#### Scenario: Assistant composes a self-evolution loop through attention-cli
- **WHEN** a user teaches `shell-assistant` a reflection workflow such as a nightly `auto-dream`-style review
- **THEN** the assistant or product can commit, query, and settle self-evolution attention contexts through attention-cli compatible APIs
- **AND** the loop can guide memory or skill updates through normal assistant reasoning
- **AND** it does not depend on a dedicated watch or schedule primitive in this change
- **AND** the kernel does not reserve `auto-dream` as a fixed product feature, score key, or scheduler branch

#### Scenario: Self-evolution attention remains separate from hosting attention
- **WHEN** a self-evolution loop is active while cli-shell managed mode is off
- **THEN** the loop may use product-scoped attention to schedule reflection or memory work
- **AND** it does not require `scores: {"hosting": 1000}`
- **AND** it does not grant terminal write authority
- **AND** any terminal write still requires the normal delegation or terminal-native approval law

#### Scenario: Future products reuse programmable attention operations
- **WHEN** another product needs a recurring learning, reflection, or maintenance loop
- **THEN** it can reuse the same attention-cli compatible commit/query/settle operations from this change
- **AND** core does not gain a product-specific branch for that product's named ritual
- **AND** if recurring watch/schedule behavior is needed, it belongs to the follow-up `extend-attention-cli-self-evolution-runtime` change

### Requirement: Product delegation SHALL be an attention-backed bounded lease

Products SHALL model terminal write autonomy as explicit delegation facts tied to attention and resource authority. A delegation SHALL name the granting user, target Avatar, target resources, expiry, policy, and revocation state. It SHALL NOT be represented only by local UI state, prompt text, or a permanent writer grant. Positive hosting attention may schedule the Avatar, but it SHALL NOT grant terminal write authority by itself.

#### Scenario: Managed toggle creates hosting attention and write-capable bounded delegation by default
- **WHEN** the user enables cli-shell managed/takeover mode
- **THEN** cli-shell commits positive hosting attention for the current product terminal and room
- **AND** cli-shell requests a product delegation for terminal write autonomy by default
- **AND** the delegation records the granting user principal, summoned Avatar principal, product id, shell name, terminal id, room id, enabled time, expiry, and policy
- **AND** the delegated terminal write authority is represented by a bounded terminal write lease or equivalent terminal-native authority

#### Scenario: Managed toggle revoke removes only delegated authority
- **WHEN** the user disables cli-shell managed/takeover mode
- **THEN** the active product delegation is revoked
- **AND** cli-shell commits a hosting attention update with `scores: {"hosting": 0}` and reason `user_disabled`
- **AND** terminal write leases created by that delegation are revoked or allowed to expire
- **AND** unrelated terminal grants, room grants, and user manual terminal input remain valid

#### Scenario: Autonomous terminal effects are attributed to the Avatar and delegation
- **WHEN** the Avatar writes terminal input while cli-shell managed/takeover is active
- **THEN** the terminal write is submitted with the Avatar actor identity
- **AND** the terminal activity record carries enough provenance to resolve the delegation and lease that authorized the write
- **AND** superadmin bootstrap authority is not used as the hidden actor for autonomous terminal effects

#### Scenario: Managed off keeps attention but blocks autonomous writes
- **WHEN** cli-shell managed/takeover mode is off
- **THEN** the Avatar may observe terminal and room context, answer in the room, and request approval
- **AND** it must not autonomously write to the terminal without a valid delegation or terminal-native approval
- **AND** terminal idle/dirty observations do not self-drive takeover work solely because the toolbar exists

#### Scenario: Hosting attention can remain open for watch tasks
- **WHEN** the active hosting objective is an open-ended watch task
- **THEN** the Avatar may keep the `hosting` score positive
- **AND** it records progress and watch policy as durable memory or attention facts
- **AND** the runtime does not force `hosting` to zero merely because one model round ended

#### Scenario: Delegation policy prevents no-progress loops
- **WHEN** a delegation is active and repeated model rounds produce no terminal progress or equivalent failures
- **THEN** the extension runtime records backoff, blocked, expired, or revoked state as explicit attention/delegation facts
- **AND** LoopBus does not spin indefinitely only because the delegation remains enabled

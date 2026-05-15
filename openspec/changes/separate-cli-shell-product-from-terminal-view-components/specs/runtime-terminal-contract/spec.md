## MODIFIED Requirements

### Requirement: Runtime terminal truth SHALL derive render, durable change log, and observation from one backend source

Whenever runtime publishes terminal state, renderable terminal state, durable terminal change-log truth, and LoopBus terminal observation ingress SHALL all originate from the same backend terminal truth rather than from client-local reconstructions.

#### Scenario: One backend change source drives renderer, commit, and observation truth
- **GIVEN** one backend terminal emits new renderable state
- **WHEN** runtime projects that change
- **THEN** renderer hydration, durable terminal change-log publication, and observation ingress refer to the same backend terminal change source
- **AND** clients do not synthesize a second authoritative transcript to bridge those paths

#### Scenario: Projection caches do not become durable terminal truth
- **WHEN** a client or host keeps local render caches
- **THEN** runtime does not promote those caches into authoritative durable terminal history or observation facts
- **AND** the runtime contract keeps backend terminal state as the only source of truth

### Requirement: Runtime publications SHALL preserve shared terminal viewport truth

Runtime terminal publications SHALL preserve shared viewport truth for same-terminal attachments when the product contract requires a single visible source of truth. Buffer content, viewport position, and visible input results SHALL remain synchronized across same-terminal clients that participate in that shared terminal attachment.

#### Scenario: Same-terminal clients observe the same visible viewport
- **WHEN** multiple clients attach to the same backend terminal through a shared terminal contract
- **THEN** runtime-facing terminal projections preserve one shared visible viewport truth for that terminal
- **AND** clients do not invent separate authoritative viewport positions for the same attachment

#### Scenario: Visible input results remain synchronized across same-terminal clients
- **WHEN** one same-terminal client sends interactive terminal input
- **THEN** other same-terminal clients can observe the resulting visible shell changes from the same backend terminal truth
- **AND** runtime projections do not require each client to reconstruct those visible changes independently

### Requirement: Runtime publications SHALL distinguish geometry authority from presentation scale

Runtime terminal projections SHALL distinguish backend terminal geometry truth from host-local presentation scaling. When a product host currently owns geometry authority, other projection hosts may present the same terminal grid without silently rewriting backend columns and rows.

#### Scenario: Cli-shell-owned geometry remains explicit to other attachments
- **WHEN** `cli-shell` owns geometry authority for a terminal through `shell-terminal-view`
- **THEN** runtime-facing geometry truth distinguishes terminal-2 full product-surface geometry from terminal-1 derived shell-truth geometry
- **AND** terminal-2 geometry remains derived from the native shell window's full visible size
- **AND** terminal-1 geometry remains derived from terminal-2 geometry after subtracting reserved product rows or docked product chrome
- **AND** other attachments can observe those geometries without inferring that they own them

#### Scenario: Web host local resize changes presentation only
- **WHEN** a `web-terminal-view` host resizes its local container while another host still owns backend geometry authority
- **THEN** runtime terminal geometry truth remains unchanged
- **AND** the Web host may still recompute local fit, cover, or zoom presentation from that shared geometry

#### Scenario: Attachment resize role is explicit instead of inferred from last writer
- **WHEN** multiple attachments are connected to the same backend terminal truth
- **THEN** runtime/control-plane can distinguish the geometry-authoritative attachment from projection-only attachments
- **AND** backend terminal geometry is not reassigned implicitly just because another projection host resized its local surface

### Requirement: Runtime/control-plane SHALL arbitrate geometry authority deterministically

When multiple attachments are capable of resizing one backend terminal truth, runtime/control-plane SHALL resolve geometry authority through explicit arbitration facts rather than by last-resizer-wins behavior.

#### Scenario: Explicit geometry order outranks later attach timing
- **GIVEN** two authority-capable attachments compete for the same terminal geometry
- **AND** one attachment declares a lower `geometry-order` than the other
- **WHEN** both attachments are live
- **THEN** runtime/control-plane resolves geometry authority to the lower-order attachment
- **AND** the higher-order attachment remains projection-only for resize purposes until the authority facts change explicitly

#### Scenario: Attach order is the fallback when explicit geometry order is absent
- **GIVEN** multiple authority-capable attachments for the same terminal do not declare an explicit `geometry-order`
- **WHEN** runtime/control-plane needs to choose geometry authority
- **THEN** it falls back to attachment creation order
- **AND** the chosen authority remains stable until lease expiry, disconnect, or an explicit role/order change

#### Scenario: Lease expiry reopens arbitration without last-resizer-wins
- **GIVEN** the current geometry-authoritative attachment disconnects or loses its authority lease
- **WHEN** runtime/control-plane reevaluates authority
- **THEN** it deterministically selects the next eligible authority attachment by explicit order and fallback attach order
- **AND** it does not promote whichever attachment happened to send the latest local resize event

#### Scenario: Resolved geometry authority is observable as backend truth
- **WHEN** runtime/control-plane resolves geometry authority for a terminal with competing attachments
- **THEN** the resolved winner and the current attachment's effective resize role are observable through shared backend truth such as transport acknowledgement or inspection output
- **AND** native and Web acceptance do not need to infer the winner indirectly from local resize timing alone

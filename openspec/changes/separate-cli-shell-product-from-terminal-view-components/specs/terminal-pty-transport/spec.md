> Superseded note:
> This delta spec is built on the older `terminal-1` / `terminal-2` cli-shell ontology.
> It remains only as historical analysis and reference input. Current work must follow `realign-cli-shell-with-core-system-boundaries`.

## ADDED Requirements

### Requirement: Canonical multi-view synchronization SHALL not depend on raw byte replay alone

Terminal transport SHALL preserve a canonical backend-authored screen, cursor, scrollback, and viewport publication path for multi-view synchronization. Raw ANSI or VT byte streams MAY still exist at PTY or renderer edges, but they SHALL remain edge adapters rather than the only shared truth between backend and multiple attachments.

#### Scenario: Multi-view synchronization uses backend screen truth rather than frontend terminal emulation truth
- **WHEN** native and Web hosts observe the same backend terminal truth
- **THEN** synchronization across those hosts is resolved from backend-authored snapshot, viewport, cursor, and running-state publication
- **AND** the system does not require each host to reconstruct the shared visible truth only by replaying raw terminal bytes locally

### Requirement: Terminal transport SHALL support shared viewport truth for same-terminal attachments

When multiple clients participate in one same-terminal shared shell attachment, terminal transport SHALL preserve one shared viewport truth in addition to the existing bytes-first input and output transport. Shared viewport mutations such as scrolling SHALL not remain hidden frontend-local state, whether the initiating attachment expresses them as relative delta movement or as an absolute viewport target.

#### Scenario: Same-terminal scroll updates are synchronized
- **WHEN** one client scrolls or targets the shared viewport for a same-terminal shell attachment
- **THEN** the shared viewport truth updates through terminal-authoritative transport or control-plane semantics
- **AND** other same-terminal clients observe the same visible viewport position

#### Scenario: Shared viewport truth does not replace bytes-first input law
- **WHEN** same-terminal clients send live terminal input
- **THEN** transport still treats that input as bytes-first interactive terminal input
- **AND** shared viewport synchronization remains additional terminal truth rather than a replacement for bytes-first input transport

### Requirement: Terminal transport SHALL keep shared viewport control explicit while preserving bytes-first shell input

When same-terminal attachments need shared viewport mutations, the transport or terminal control-plane contract SHALL express those mutations as explicit terminal-authoritative facts instead of hiding them inside host-local UI state. Printable input, paste, and terminal control keys SHALL remain bytes-first live input.

#### Scenario: Shared viewport control does not require a frontend-only state machine
- **WHEN** a same-terminal attachment mutates the shared viewport
- **THEN** that mutation is expressed through explicit terminal-authoritative synchronization
- **AND** other attachments do not need a second frontend-owned terminal model to discover it

#### Scenario: Viewport mutation is echoed back through backend terminal truth
- **WHEN** one same-terminal attachment requests a viewport mutation such as scroll up, scroll down, or an absolute viewport start
- **THEN** runtime/control-plane applies that mutation against backend terminal truth first
- **AND** the resulting shared viewport position is republished to all attachments through authoritative terminal publication
- **AND** the initiating attachment also treats that republished viewport as the visible-truth confirmation

#### Scenario: Shell input remains bytes-first after shared viewport support is added
- **WHEN** a same-terminal attachment sends printable input, paste, or terminal control keys
- **THEN** transport still forwards that live shell input through the bytes-first path
- **AND** shared viewport support does not reinterpret those inputs as projection-only host events

### Requirement: Terminal transport SHALL expose geometry arbitration facts in the shared attachment contract

When multiple frontends may attach to one backend terminal truth, the shared transport attachment contract SHALL carry enough geometry-authority facts for backend control-plane to arbitrate deterministically. Geometry authority SHALL NOT remain an unobservable local convention or a product-local helper outside the shared transport/control-plane truth.

#### Scenario: Attachment hello declares requested geometry role and explicit order
- **WHEN** an attachment connects to shared transport for one backend terminal truth
- **THEN** the attachment handshake may declare requested geometry participation facts such as `geometryRole` and optional explicit `geometry-order`
- **AND** those facts are treated as backend arbitration input rather than as immediate self-authorized ownership

#### Scenario: Backend hello acknowledgement exposes resolved authority facts
- **WHEN** backend transport/control-plane accepts or updates an attachment handshake
- **THEN** the shared transport acknowledgement exposes backend-resolved geometry facts for that attachment
- **AND** the acknowledgement includes enough identity to distinguish the current attachment from competing attachments
- **AND** backend-resolved authority truth is observable without inferring it from local resize timing

#### Scenario: Missing explicit order falls back to backend attachment creation order
- **GIVEN** multiple authority-capable attachments omit explicit `geometry-order`
- **WHEN** backend control-plane resolves geometry authority
- **THEN** it falls back to backend attachment creation order
- **AND** later local resize attempts do not silently override that resolved order

#### Scenario: Authority reevaluation is triggered by backend liveness facts
- **GIVEN** one attachment currently owns backend geometry authority
- **WHEN** that attachment disconnects, expires, or explicitly changes its declared geometry participation facts
- **THEN** backend control-plane reevaluates authority deterministically
- **AND** the reevaluation result is again observable through shared transport/control-plane truth

#### Scenario: Product-local claim helpers do not replace shared backend authority truth
- **WHEN** a product host provides convenience claim or release helpers for geometry ownership
- **THEN** those helpers act only as adapters over the shared backend authority contract
- **AND** they do not become an independent final source of geometry authority outside transport/control-plane truth

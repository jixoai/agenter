## ADDED Requirements

### Requirement: Product extension runtime SHALL expose APIs instead of owning product lifecycle reactions

The product extension runtime SHALL remain a public API and projection surface for products. It MAY expose resource binding, lifecycle subscription, and owner-system operation contracts. It SHALL NOT own product-specific lifecycle reactions such as shell-next terminal killed -> archive bound room.

#### Scenario: Product code programs against public lifecycle APIs

- **WHEN** a product needs to react to terminal, room, or attention lifecycle
- **THEN** the product consumes public lifecycle/API contracts
- **AND** the product implements its product-specific reaction in its own package
- **AND** the product extension runtime does not become a bottom-layer reaction host for that product behavior

#### Scenario: Core remains product-agnostic when shell-next reaction exists

- **WHEN** shell-next implements terminal killed -> archive bound room
- **THEN** core terminal, room, attention, and product-extension runtime modules remain valid without importing shell-next code
- **AND** no core module contains a branch equivalent to "if product is shell-next"

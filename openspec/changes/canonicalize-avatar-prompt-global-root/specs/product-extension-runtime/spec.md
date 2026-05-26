# product-extension-runtime Specification

## MODIFIED Requirements

### Requirement: Product extensions SHALL initialize assistant resources through generic APIs

The extension runtime SHALL let products ensure Avatar, global prompt-source, and avatar-private memory resources through generic Avatar and WorkspaceSystem APIs. Product packages SHALL provide product defaults, but core runtime modules SHALL remain product-agnostic and prompt/memory files SHALL remain openly editable user assets. Product prompt seed APIs SHALL seed only the global Avatar canonical `AGENTER.mdx`; they SHALL NOT accept or interpret a workspace path as prompt root authority.

#### Scenario: Extension ensures default assistant without core special case
- **WHEN** cli-shell needs default Avatar `shell-assistant`
- **THEN** it requests Avatar ensure through a generic Avatar/product-extension API
- **AND** it may create missing product-owned prompt and memory defaults through generic APIs
- **AND** core launcher modules do not hard-code the `shell-assistant` nickname

#### Scenario: Extension prompt initialization stays open and seed-if-missing
- **GIVEN** product-owned default prompt or memory resources already exist for an Avatar
- **WHEN** cli-shell runs its initialization flow
- **THEN** it reads the existing files as current truth
- **AND** it creates missing resources without locking or automatically restoring product defaults over user edits
- **AND** advanced users may edit those resources manually

#### Scenario: Product prompt seed ignores workspace locality
- **GIVEN** cli-shell starts from workspace `/repo`
- **AND** Avatar `shell-assistant` resolves to principal `0xabc...`
- **WHEN** cli-shell seeds the missing assistant prompt
- **THEN** the seed target is `~/.agenter/avatars/by-principal/0xabc.../AGENTER.mdx`
- **AND** the product-extension prompt seed contract does not expose `/repo` as a prompt root input

# svelte-components-platform Specification

## Purpose
Define the shared Svelte structural package that owns durable scroll ownership and scaffold-family layout law across reusable Svelte clients.

## Requirements
### Requirement: Shared Svelte structural primitives SHALL live in @agenter/svelte-components
The repository SHALL expose `@agenter/svelte-components` as the shared Svelte structural package for durable scroll ownership and scaffold-family layout law. Shared Svelte consumers SHALL import structural primitives from that package instead of reaching into product-local `webui` source.

#### Scenario: Shared Svelte consumer resolves one structural package
- **WHEN** a shared Svelte package such as `web-chat-view` needs transcript scrolling or shell layout primitives
- **THEN** it imports them from `@agenter/svelte-components`
- **THEN** it does not depend on `@agenter/webui` to recover those primitives

#### Scenario: Shared structural package exports the scaffold family together
- **WHEN** engineers consume `@agenter/svelte-components`
- **THEN** the package exports `ScrollView`, `Scaffold`, `DialogScaffold`, and `SplitView`
- **THEN** the internal shrink/stretch law remains bound to internal layout hooks instead of public slot names

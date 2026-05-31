## MODIFIED Requirements

### Requirement: Shared Svelte structural primitives SHALL live in @agenter/svelte-components

The repository SHALL expose `@agenter/svelte-components` as the shared Svelte structural package for durable scroll ownership and scaffold-family layout law. Shared Svelte consumers SHALL import structural primitives from that package instead of reaching into app-local `webui` source. That package SHALL expose `ScrollView` for standard surfaces and the anchored virtual list scroll platform for WebChat-like virtual long lists.

#### Scenario: Shared Svelte consumer resolves one structural package

- **WHEN** a shared Svelte package such as `web-chat-view` needs transcript scrolling or shell layout primitives
- **THEN** it imports them from `@agenter/svelte-components`
- **THEN** it does not depend on `@agenter/webui` to recover those primitives

#### Scenario: Shared structural package exports standard and anchored scroll law together

- **WHEN** engineers consume `@agenter/svelte-components`
- **THEN** the package exports `ScrollView` for standard surfaces
- **AND** it exports the anchored virtual list scroll platform for WebChat-like long lists
- **AND** consumers do not need a second app-local package just to recover anchored transcript scrolling

#### Scenario: Shared structural package remains the initial package boundary

- **WHEN** the anchored virtual list scroll law is introduced
- **THEN** the first implementation lands inside `@agenter/svelte-components`
- **AND** the repository does not create a standalone scroll package before the shared Svelte package boundary proves insufficient

#### Scenario: Shared structural package exports the scaffold family together

- **WHEN** engineers consume `@agenter/svelte-components`
- **THEN** the package exports `Scaffold`, `DialogScaffold`, and `SplitView` alongside the shared scroll platform
- **THEN** the internal shrink/stretch law remains bound to internal layout hooks instead of public slot names

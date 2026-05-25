# svelte-components-platform Specification

## Purpose
Define the shared Svelte structural package that owns durable scroll ownership and scaffold-family layout law across reusable Svelte clients.
## Requirements
### Requirement: Shared Svelte structural primitives SHALL live in @agenter/svelte-components
The repository SHALL expose `@agenter/svelte-components` as the shared Svelte structural package for durable scroll ownership and scaffold-family layout law. Shared Svelte consumers SHALL import structural primitives from that package instead of reaching into product-local `studio` source. That package SHALL expose `ScrollView` for standard surfaces, the anchored virtual list scroll platform for WebChat-like virtual long lists, and the shared scaffold family through `Scaffold`, `DialogScaffold`, and `SidebarScaffold`. The anchored virtual list platform exported from this package SHALL own the full transaction runtime, ownership chain, and terminal viewport writer rather than leaving render-layer or consumer-layer code to complete scroll choreography privately.

#### Scenario: Shared Svelte consumer resolves one structural package
- **WHEN** a shared Svelte package such as `web-chat-view` needs transcript scrolling or shell layout primitives
- **THEN** it imports them from `@agenter/svelte-components`
- **THEN** it does not depend on `agenter-ext-studio` to recover those primitives

#### Scenario: Shared structural package exports standard and anchored scroll law together
- **WHEN** engineers consume `@agenter/svelte-components`
- **THEN** the package exports `ScrollView` for standard surfaces
- **AND** it exports the anchored virtual list scroll platform for WebChat-like long lists
- **AND** consumers do not need a second product-local package just to recover anchored transcript scrolling

#### Scenario: Shared structural package remains the initial package boundary
- **WHEN** the anchored virtual list scroll law is introduced
- **THEN** the first implementation lands inside `@agenter/svelte-components`
- **AND** the repository does not create a standalone scroll package before the shared Svelte package boundary proves insufficient

#### Scenario: Shared anchored runtime owns the full viewport choreography
- **WHEN** append, prepend, insert motion, or target materialization occurs inside an anchored virtual list
- **THEN** the shared package runtime owns the final viewport choreography
- **AND** consumer packages do not need package-local preserve or reveal controllers to complete the flow

#### Scenario: Shared structural package exports the scaffold family together
- **WHEN** engineers consume `@agenter/svelte-components`
- **THEN** the package exports `Scaffold`, `DialogScaffold`, and `SidebarScaffold` alongside the shared scroll platform
- **THEN** the internal shrink/stretch law remains bound to internal layout hooks instead of public slot names

### Requirement: Shared structural package SHALL export the workbench split-detail primitive
`@agenter/svelte-components` SHALL expose the shared workbench split-detail primitive and its ratio-source types from the structural package itself. That primitive SHALL stay responsible for geometry, ratio persistence, and clamp math, including the geometry needed to hide desktop detail without entering compact mode. Shared consumers SHALL compose this primitive from `@agenter/svelte-components` instead of rebuilding resize or width-resolution behavior inside product code.

#### Scenario: Shared consumer imports the split-detail primitive from one package
- **WHEN** a Svelte route or shared client needs a persistent `main + right detail` shell
- **THEN** it imports the split-detail primitive from `@agenter/svelte-components`
- **THEN** it does not reach into `agenter-ext-studio` to recover resize or width-resolution math

#### Scenario: Structural package exports ratio-source contracts together
- **WHEN** engineers consume the split-detail primitive
- **THEN** the package also exports the ratio-source contract needed for string-key or custom-provider persistence
- **THEN** routes can customize storage behavior without forking the primitive itself

### Requirement: Shared structural package SHALL provide the default global ratio source
`@agenter/svelte-components` SHALL provide the default global ratio source used by string-key split-detail layouts. That default source SHALL persist ratio values through IndexedDB and synchronize updates across windows through `BroadcastChannel`.

#### Scenario: Default ratio source survives reload
- **WHEN** the operator reloads a route that uses a string-key split-detail layout
- **THEN** the default ratio source restores the last persisted ratio from IndexedDB
- **THEN** the route does not fall back to feature-local hard-coded drawer widths

#### Scenario: Default ratio source synchronizes across windows
- **WHEN** one browser window updates the ratio for a shared string key
- **THEN** another window listening to that same key receives the updated ratio through the default shared source
- **THEN** the synchronization path does not require route-local BroadcastChannel wiring

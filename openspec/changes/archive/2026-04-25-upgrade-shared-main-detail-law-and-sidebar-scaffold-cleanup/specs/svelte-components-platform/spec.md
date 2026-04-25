## MODIFIED Requirements

### Requirement: Shared structural package SHALL live in @agenter/svelte-components
The repository SHALL expose `@agenter/svelte-components` as the shared Svelte structural package for durable scroll ownership and scaffold-family layout law. Shared Svelte consumers SHALL import structural primitives from that package instead of reaching into product-local `webui` source. That package SHALL expose `ScrollView` for standard surfaces, the anchored virtual list scroll platform for WebChat-like virtual long lists, and the shared scaffold family through `Scaffold`, `DialogScaffold`, and `SidebarScaffold`.

#### Scenario: Shared Svelte consumer resolves one structural package
- **WHEN** a shared Svelte package such as `web-chat-view` needs transcript scrolling or shell layout primitives
- **THEN** it imports them from `@agenter/svelte-components`
- **THEN** it does not depend on `@agenter/webui` to recover those primitives

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
- **THEN** it does not reach into `@agenter/webui` to recover resize or width-resolution math

#### Scenario: Structural package exports ratio-source contracts together
- **WHEN** engineers consume the split-detail primitive
- **THEN** the package also exports the ratio-source contract needed for string-key or custom-provider persistence
- **THEN** routes can customize storage behavior without forking the primitive itself

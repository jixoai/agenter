## ADDED Requirements

### Requirement: Shared structural package SHALL export the workbench split-detail primitive
`@agenter/svelte-components` SHALL expose the shared workbench split-detail primitive and its ratio-source types from the structural package itself. Shared consumers SHALL compose this primitive from `@agenter/svelte-components` instead of rebuilding resize, clamp, and compact right-detail behavior inside product code.

#### Scenario: Shared consumer imports the split-detail primitive from one package
- **WHEN** a Svelte route or shared client needs a persistent `main + right detail` shell
- **THEN** it imports the split-detail primitive from `@agenter/svelte-components`
- **THEN** it does not reach into `@agenter/webui` to recover resize or compact-detail layout law

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

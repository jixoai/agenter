## MODIFIED Requirements

### Requirement: Lit web-components SHALL expose stable styling slots through css-part
Framework-agnostic Lit atoms in `@agenter/web-components` SHALL expose stable visual slots through `css-part` whenever their visible surfaces need downstream theming. Svelte structural primitives such as `ScrollView`, `Scaffold`, `DialogScaffold`, and `SplitView` SHALL NOT be implemented in `@agenter/web-components`; they belong to the shared Svelte structural package instead.

#### Scenario: Lit atom boundary excludes Svelte layout primitives
- **WHEN** engineers need a durable Svelte scroll or shell primitive
- **THEN** they add it to `@agenter/svelte-components`
- **THEN** `@agenter/web-components` remains limited to Lit custom-element atoms and their styling contracts

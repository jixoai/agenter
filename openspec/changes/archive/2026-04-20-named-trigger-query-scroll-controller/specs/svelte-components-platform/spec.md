## MODIFIED Requirements

### Requirement: Shared structural package SHALL export the named anchored-scroll controller and trigger families

`@agenter/svelte-components` SHALL export the anchored virtual list named scroll controller, trigger-family helpers, and typed trigger-name helpers from the structural package itself. Shared Svelte consumers SHALL compose anchored transcript behavior from those exports instead of rebuilding observer graphs in app-local code.

#### Scenario: Shared consumer imports named scroll law from one package

- **WHEN** a shared Svelte consumer such as WebChat or Heartbeat needs anchored transcript scrolling
- **THEN** it imports the controller, trigger helpers, and typed names from `@agenter/svelte-components`
- **AND** it does not reach into app-local `webui` code to reconstruct the same runtime

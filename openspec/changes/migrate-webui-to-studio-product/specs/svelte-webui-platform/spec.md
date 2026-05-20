## MODIFIED Requirements

### Requirement: SvelteKit package SHALL be the active WebUI platform

The repository SHALL expose `@agenter/studio` as the active SvelteKit 2 + Svelte 5 operator package, and the previous React implementation SHALL be retained only as an inactive reference package under a non-conflicting identity. The term WebUI remains historical wording for this capability only; active product identity SHALL be Studio.

#### Scenario: Active package resolution

- **WHEN** workspace package discovery resolves `@agenter/studio`
- **THEN** it resolves to the active SvelteKit operator package rather than the archived React package

#### Scenario: Archived React package remains available

- **WHEN** engineers need implementation reference from the previous UI
- **THEN** the React package remains available under a non-conflicting package identity

## REMOVED Requirements

### Requirement: CLI delivery SHALL serve the SvelteKit app as static SPA assets

**Reason**: Active operator UI delivery is no longer a core CLI responsibility. The product package `@agenter/studio` owns static and dev serving after the migration.

**Migration**: Use `agenter studio` to launch the Studio product. Studio-owned specs define static root, nested-route fallback, and runtime env injection.

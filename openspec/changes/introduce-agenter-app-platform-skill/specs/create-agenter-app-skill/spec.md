## ADDED Requirements

### Requirement: Repository SHALL include a community-installable create-agenter-app skill

The repository SHALL include `skills/create-agenter-app` as a standard skill folder. The skill SHALL be usable from inside this repository and installable by community skill installers such as `npx skills add`. The skill SHALL teach agents how to create Agenter apps without requiring the agent to rediscover descriptor, peer dependency, workspace, and validation rules from scratch.

#### Scenario: Skill folder has standard entrypoint

- **WHEN** a skill installer or agent inspects `skills/create-agenter-app`
- **THEN** the folder contains `SKILL.md`
- **AND** `SKILL.md` has frontmatter with `name: create-agenter-app`
- **AND** the description clearly says the skill creates or updates Agenter app packages

#### Scenario: Skill is portable outside this repository

- **WHEN** the skill is installed into another agent's skills directory
- **THEN** its core instructions still explain how to create an Agenter app
- **AND** repo-local conveniences are described as optional repo mode rather than required hidden assumptions

#### Scenario: Skill remains useful inside the Agenter repository

- **WHEN** an agent works in this repository and uses `create-agenter-app`
- **THEN** the skill can scaffold or validate a first-party app under `apps/*`
- **AND** it uses the same app descriptor and compatibility laws as community app packages

### Requirement: Create-agenter-app skill SHALL bundle Bun scripts for deterministic scaffolding and validation

The `create-agenter-app` skill SHALL include Bun-based TypeScript scripts under `skills/create-agenter-app/scripts/`. Scripts SHALL use `#!/usr/bin/env bun`, SHALL be runnable without Python or npm-only shell glue, and SHALL validate the generated app package against Agenter app-platform contracts.

#### Scenario: Scaffold script creates a minimal app package

- **WHEN** an agent runs the skill scaffold script with an app id, command, package name, and target directory
- **THEN** the script writes a minimal app package structure
- **AND** the package declares `peerDependencies.agenter`
- **AND** the package exposes app descriptor or manifest data for command, bin, main export, and capability hints
- **AND** the package contains Bun-friendly scripts for typecheck and test placeholders

#### Scenario: Validate script checks app-platform metadata

- **WHEN** an agent runs the skill validation script against an app package directory
- **THEN** it verifies package name, `peerDependencies.agenter`, app id, command, bin metadata, and manifest or descriptor shape
- **AND** it fails clearly when compatibility or launch metadata is missing

#### Scenario: Scripts support repo mode and external mode

- **WHEN** the scripts run inside the Agenter repository
- **THEN** they can default the first-party app target root to `apps/*`
- **AND** when they run outside the repository, they require an explicit target directory or infer the current working directory without depending on Agenter repo paths

### Requirement: Create-agenter-app guidance SHALL encode compatibility-by-peerDeps

The skill SHALL instruct agents that app compatibility is declared by the app package through `peerDependencies.agenter`. It SHALL NOT teach agents to add new host-owned version lock tables in Agenter when creating a community app.

#### Scenario: Skill teaches reverse compatibility lookup

- **WHEN** an agent reads the skill
- **THEN** it explains that Agenter filters app versions by `peerDependencies.agenter`
- **AND** app package authors own the compatibility range
- **AND** host-owned lock tables are described as the rejected path

#### Scenario: Skill teaches app discovery as separate from compatibility

- **WHEN** an agent creates a community app package
- **THEN** the skill instructs it to include discovery metadata such as package keywords or catalog-ready manifest data
- **AND** it keeps compatibility in `peerDependencies.agenter`
- **AND** it keeps command launch metadata in the app descriptor or manifest

### Requirement: Create-agenter-app skill SHALL keep progressive disclosure lean

The skill SHALL keep `SKILL.md` concise and put deterministic logic in scripts. Detailed examples or templates MAY live under skill resources only when they prevent repeated large code generation. The skill SHALL NOT add unrelated README, changelog, or auxiliary prose files that duplicate `SKILL.md`.

#### Scenario: Skill entrypoint stays concise

- **WHEN** reviewers inspect `skills/create-agenter-app/SKILL.md`
- **THEN** it contains the core workflow and script usage
- **AND** it points to bundled scripts when deterministic work is needed
- **AND** it does not duplicate large templates inline when scripts can generate them

#### Scenario: Scripts are preferred for fragile package edits

- **WHEN** an agent needs to scaffold package JSON, descriptor, bin entrypoint, or validation rules
- **THEN** the skill directs the agent to use the bundled Bun scripts
- **AND** handwritten ad hoc package scaffolding is treated as a fallback only when scripts cannot run

# runtime-skill-home-projection Specification

## Purpose

Define `SKILLS_HOME` derivation, source expansion, visible skill precedence, and migration behavior for runtime-visible file-backed skills.

## Requirements

### Requirement: SKILLS_HOME SHALL be derived from workspace-grouped PWD plus AVATAR_HOME

SkillSystem SHALL derive `SKILLS_HOME` from workspace groups. Each group SHALL expand that workspace's `PWD` roots before that workspace instance's `AVATAR_HOME` roots. Multi-workspace derivation SHALL preserve group order, for example `w1-pwd;w1-avatar-home;w2-pwd;w2-avatar-home;...`. Because source merge is last-wins, Avatar-home skills override project PWD skills inside the same workspace group, and later workspace groups override earlier groups.

The derived value SHALL be an ordered absolute path list with the same delimiter law as `AVATAR_HOME`: canonical writes use `;`, readers understand `;`, and non-Windows readers also understand the OS path delimiter `:`.

#### Scenario: SKILLS_HOME derives one workspace group from PWD then avatar homes

- **GIVEN** `AVATAR_HOME` is `/avatar/base;/avatar/user`
- **AND** `PWD` is `/repo`
- **WHEN** SkillSystem derives `SKILLS_HOME`
- **THEN** the result includes skill roots expanded from `/repo`, then `/avatar/base`, then `/avatar/user`
- **AND** conflicts from `/avatar/user` override conflicts from `/repo`

#### Scenario: Multi-workspace SKILLS_HOME keeps workspace groups

- **GIVEN** workspace group one has `PWD=/repo-a` and `AVATAR_HOME=/avatar/a`
- **AND** workspace group two has `PWD=/repo-b` and `AVATAR_HOME=/avatar/b`
- **WHEN** SkillSystem derives `SKILLS_HOME`
- **THEN** the source group order is `/repo-a`, `/avatar/a`, `/repo-b`, `/avatar/b`
- **AND** conflicts from workspace group two override conflicts from workspace group one

#### Scenario: PWD skills remain available without AVATAR_HOME

- **GIVEN** `AVATAR_HOME` is empty
- **AND** `PWD` is `/repo`
- **WHEN** SkillSystem derives `SKILLS_HOME`
- **THEN** PWD-local skill roots may still be included
- **AND** avatar-private skill roots are not invented from root workspace paths

### Requirement: Skill root expansion SHALL support generic and agent-specific skill directories

For each base root contributed by PWD or `AVATAR_HOME`, SkillSystem SHALL expand directory-level skill roots using this default order:

1. `<root>/skills`
2. `<root>/.codex/skills`
3. `<root>/.claude/skills`
4. `<root>/.agents/skills`

The expansion SHALL be pure and SHALL NOT create directories. Missing directories simply contribute no skills.

#### Scenario: Dot-agent skill directories override generic skills

- **GIVEN** `/repo/skills/build/SKILL.md` and `/repo/.codex/skills/build/SKILL.md` both exist
- **WHEN** SkillSystem merges the derived roots for `/repo`
- **THEN** the `.codex` skill wins over the generic `/repo/skills` skill
- **AND** the merge result records which source path produced the visible skill

#### Scenario: Missing skill roots do not create filesystem state

- **GIVEN** `/repo/.agents/skills` does not exist
- **WHEN** SkillSystem derives and scans skill roots
- **THEN** no directory is created
- **AND** the missing root contributes no skills

### Requirement: SkillSystem SHALL read skill sources from SKILLS_HOME rather than rootWorkspacePath

Runtime skill discovery, skill CLI commands, and Studio skill browsing SHALL consume the same `SKILLS_HOME`-derived multi-source merge law. The skill contract MUST NOT require `rootWorkspacePath` as the Avatar skill-layer authority. Built-in or plugin-provided read-only skills MAY remain separate providers, but they SHALL be merged through the same explicit source ordering model rather than through hidden root workspace special cases.

#### Scenario: Skill CLI follows current workspace SKILLS_HOME

- **GIVEN** a workspace instance has a derived `SKILLS_HOME`
- **WHEN** `skill list` runs inside that workspace bash
- **THEN** it lists skills from that derived source list
- **AND** it does not use `rootWorkspacePath/skills` as a hidden avatar root

#### Scenario: Built-in skills remain explicit read-only sources

- **GIVEN** built-in runtime skills are available
- **WHEN** SkillSystem merges visible skills
- **THEN** built-in skills are marked as read-only sources
- **AND** file-backed `SKILLS_HOME` sources may override them only through the declared source ordering law

#### Scenario: Studio skill browser explains source order

- **WHEN** Studio displays visible skills for a workspace instance
- **THEN** it can show the `SKILLS_HOME` source path that produced each visible skill
- **AND** it does not need to reconstruct visibility from global/project workspace grouping heuristics

#### Scenario: Legacy rootWorkspacePath skills are not silently lost

- **GIVEN** an existing runtime has user-owned skills under `<rootWorkspacePath>/skills`
- **WHEN** the runtime is evaluated through the Env-first SkillSystem law
- **THEN** those skills remain visible when the avatar-root workspace contributes that root through `AVATAR_HOME` and derived `SKILLS_HOME`
- **AND** legacy callers that have not yet supplied `SKILLS_HOME` may use `rootWorkspacePath/skills` only as a compatibility fallback, not as the new authority source

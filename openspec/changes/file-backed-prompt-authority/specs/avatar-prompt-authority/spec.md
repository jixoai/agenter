## ADDED Requirements

### Requirement: Avatar prompt authority SHALL be file-backed at the canonical principal root

Avatar prompt truth SHALL be the canonical global principal-root file `~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`. Nickname aliases, workspace-local Avatar directories, session-local prompt snapshots, settings prompt paths, imported package defaults, and in-memory prompt text MUST NOT become runtime prompt authority.

Non-default Avatar creation and app-owned assistant initialization SHALL seed `AGENTER.mdx` only when the canonical file is missing. Existing non-default Avatar prompt files SHALL remain user-owned and MUST NOT be overwritten by daemon startup, app startup, or package prompt upgrades.

#### Scenario: Normal Avatar prompt is seeded once

- **GIVEN** a non-default Avatar principal exists without a canonical `AGENTER.mdx`
- **WHEN** the runtime ensures that Avatar prompt
- **THEN** it writes the configured seed to `~/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx`
- **AND** the file becomes the prompt truth for later renders

#### Scenario: Existing normal Avatar prompt is not overwritten

- **GIVEN** a non-default Avatar has an existing canonical `AGENTER.mdx`
- **WHEN** daemon startup, app startup, or package prompt materialization runs
- **THEN** the existing Avatar prompt file remains unchanged
- **AND** prompt inheritance changes must be expressed by editing that file or by changing files it explicitly Slots

### Requirement: Default Avatar SHALL be a declared locked fallback prompt

The `default` Avatar SHALL be a named privileged exception to normal Avatar prompt ownership. Its canonical `AGENTER.mdx` SHALL still be a visible file, but its authority SHALL be daemon startup, not user editing. On every daemon startup, the runtime SHALL overwrite the `default` Avatar canonical `AGENTER.mdx` with the canonical default prompt wrapper.

The system SHALL expose this ownership policy as `daemon-managed locked fallback` or an equivalent explicit status. Manual edits to the default Avatar prompt SHALL be treated as temporary and MUST NOT be represented as durable user ownership.

#### Scenario: Daemon startup restores locked default prompt

- **GIVEN** the default Avatar canonical `AGENTER.mdx` was edited by an operator
- **WHEN** the daemon starts
- **THEN** the runtime overwrites that file with the canonical default prompt wrapper
- **AND** the prompt inspection surface reports that the file is daemon-managed and locked

#### Scenario: Default lock is visible rather than hidden mutation

- **GIVEN** an operator inspects the default Avatar prompt source
- **WHEN** the runtime returns prompt source metadata
- **THEN** it includes the canonical prompt path
- **AND** it includes the locked fallback ownership policy
- **AND** it does not present daemon overwrite behavior as ordinary user-owned file persistence

### Requirement: Builtin prompt docs SHALL be managed files inherited by explicit Slot

Daemon startup SHALL materialize platform builtin prompt docs under `~/.agenter/builtin/<lang>/`. Builtin prompt docs are platform-managed assets and MAY be overwritten by daemon startup. Avatar prompts that inherit platform defaults SHALL do so by explicitly writing a Slot such as `<Slot src="global:builtin/$LANG/AGENTER.mdx" />` in their canonical `AGENTER.mdx`.

Builtin prompt docs MUST NOT be hidden process memory authority. If builtin prompt files are missing or stale relative to daemon startup expectations, the system SHALL expose diagnostics that distinguish missing materialization, stale daemon code, and prompt render failure.

#### Scenario: Avatar wrapper inherits builtin prompt through a visible file dependency

- **GIVEN** an Avatar canonical `AGENTER.mdx` contains a `global:builtin/$LANG/AGENTER.mdx` Slot
- **WHEN** the runtime renders the prompt
- **THEN** it reads the materialized builtin file under `~/.agenter/builtin/<lang>/`
- **AND** that file appears in the prompt dependency graph

#### Scenario: Missing builtin materialization is diagnosable

- **GIVEN** a running daemon has not materialized `~/.agenter/builtin/<lang>/`
- **WHEN** prompt inspection or rendering checks the builtin Slot
- **THEN** the system reports the missing managed prompt root as a source problem
- **AND** it does not silently fall back to an imported in-memory prompt without dependency evidence


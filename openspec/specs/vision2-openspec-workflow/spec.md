# vision2-openspec-workflow Specification

## Purpose

Define Agenter's simplified project-local OpenSpec workflow where an interview
record is the intent source of truth, specs and tasks drive implementation,
GitHub-style issue files drive iteration, and a footnote-indexed toc closes the
change. vision2 coexists with the original `vision-driven` schema and does not
rewrite existing changes.

## Requirements

### Requirement: vision2 schema SHALL make the interview record the first artifact

The project SHALL provide a project-local OpenSpec schema named `vision2`. Its
first artifact SHALL be `interview`, and that artifact SHALL generate
`interview_plan.md` as the intent source of truth. The interview artifact SHALL
preserve the user's underlying intent and every requirement-bearing Q&A as an
objective record that later automated decisions can consult. The interview
record SHALL preserve version history through the interview process itself and
SHALL NOT create a `plans/` directory or `plan-vN.md` backups.

#### Scenario: New change starts from an interview

- **GIVEN** a change is created with schema `vision2`
- **WHEN** OpenSpec reports artifact status
- **THEN** the first artifact is `interview`
- **AND** the output path for that artifact is `interview_plan.md`
- **AND** no `plans/plan.md` or `plans/plan-vN.md` file is required

#### Scenario: Interview is conducted one question at a time

- **GIVEN** the interview artifact is being produced
- **WHEN** the interviewer needs information from the user
- **THEN** questions are asked one at a time
- **AND** each question is preceded by a recommended answer with reasoning
- **AND** any question answerable from the codebase or existing OpenSpec changes/specs is answered by exploration instead of asking the user

### Requirement: vision2 workflow SHALL derive specs and tasks from the interview record

The `vision2` schema SHALL require specs after `interview`, and tasks after
specs. Tasks SHALL remain checkbox-trackable by OpenSpec apply instructions and
SHALL include BDD work that traces back to `interview_plan.md`.

#### Scenario: Specs and tasks are dependency ordered

- **GIVEN** a `vision2` change has no artifacts yet
- **WHEN** OpenSpec reports artifact status
- **THEN** `specs` is blocked by `interview`
- **AND** `tasks` is blocked by `specs`
- **AND** apply tracking uses `tasks.md`

### Requirement: Iteration findings SHALL be recorded as GitHub-style issue files

The `vision2` workflow SHALL record problems discovered during implementation or
verification as one file per finding under `issues/`, named `NNN-slug.md`, with
YAML front matter containing at least `title`, `state`, and
`github_issue_status`, and a body containing `## Summary`, `## Impact`,
`## Evidence`, plus `## Recommendation` or `## Resolution`. Closed or resolved
issues SHALL be archived under `issues/closed/`. The workflow SHALL NOT use a
`review/` directory.

#### Scenario: A new problem surfaces during implementation

- **GIVEN** a problem not covered by the original plan is found during apply
- **WHEN** the agent records the finding
- **THEN** it is written as `issues/NNN-slug.md` with the required front matter and sections
- **AND** no `review/` directory or `review/self-review.md` file is created

### Requirement: The close artifact SHALL index every spec file with Markdown footnotes

The `vision2` schema SHALL include a `close` artifact that generates `toc.md`.
The toc SHALL contain a preface summarizing the change and a footnote reference
block that cites every file under `specs/**/*.md` using Markdown footnotes of
the form `[^id]: <relative-path>`. Every cited path SHALL point to a file that
exists. The controller `check` command SHALL flag any spec file not cited by a
footnote as an orphan and any footnote path that does not exist as a dangling
reference.

#### Scenario: All specs are cited and all footnotes resolve

- **GIVEN** a `vision2` change has `specs/**/*.md` files
- **WHEN** `toc.md` cites each spec file with a footnote
- **THEN** `check` reports no orphan specs and no dangling footnotes

#### Scenario: An uncited spec is flagged

- **GIVEN** a `vision2` change has a spec file not cited by any toc footnote
- **WHEN** `check` runs
- **THEN** it reports the spec file as an orphan and exits non-zero

#### Scenario: A dangling footnote is flagged

- **GIVEN** a `vision2` change has a toc footnote pointing to a non-existent path
- **WHEN** `check` runs
- **THEN** it reports the footnote as dangling and exits non-zero

### Requirement: Controller SHALL enforce vision2-specific entrypoints and the proof gate

The repository SHALL provide a controller entrypoint for vision2 workflow
mechanics. The controller SHALL provide schema-scoped wrappers for creating a
`vision2` change, checking artifact status, fetching artifact instructions, and
strictly validating a change. The controller SHALL support commit-evidence
checks for the `interview`, `apply`, `close`, and `archive` phases, writing
abnormal-exit handoff evidence with `vN.HANDOFF.md` versioning, safely renaming
active changes, listing and validating issue files, and the final `check` proof
gate. The `check` command SHALL validate `interview_plan.md`, `tasks.md`,
`toc.md`, toc footnote coverage of every spec, footnote target existence, issue
file structure, and open-issue convergence.

#### Scenario: Open issues keep the workflow iterating

- **GIVEN** a `vision2` change passes all structural checks but has at least one `state: open` issue
- **WHEN** `check` runs
- **THEN** it exits with code 2 as a loop signal
- **AND** it reports the count of open issues

#### Scenario: All issues closed allows exit

- **GIVEN** a `vision2` change passes all structural checks and has no `state: open` issues
- **WHEN** `check` runs
- **THEN** it exits with code 0

#### Scenario: Schema-scoped workflow commands stay explicit

- **GIVEN** generic OpenSpec CLI commands may resolve a different default workflow
- **WHEN** the vision2 controller creates, inspects, instructs, or validates a change
- **THEN** it passes explicit `vision2` schema arguments
- **AND** strict change validation runs with `--type change --strict`

### Requirement: Abnormal exit SHALL produce change-local handoff evidence

If the vision2 workflow cannot exit normally, it SHALL produce `HANDOFF.md`
inside the active change directory. If `HANDOFF.md` already exists, the previous
file SHALL be renamed to the next `vN.HANDOFF.md` before the new handoff is
written. The handoff SHALL be built from repository evidence and SHALL accept
operator-authored content via Here Document stdin.

#### Scenario: Handoff preserves continuation state

- **GIVEN** a `vision2` change cannot exit normally
- **WHEN** the controller writes handoff evidence
- **THEN** `openspec/changes/<change>/HANDOFF.md` exists
- **AND** any previous handoff is preserved as `vN.HANDOFF.md`

### Requirement: vision2 SHALL coexist with vision-driven and spec-driven changes

Introducing the `vision2` schema SHALL NOT alter the project default schema,
SHALL NOT rewrite existing `vision-driven` or `spec-driven` changes, and SHALL
NOT remove the `vision-driven` schema or its controller. Each change is resolved
by its own `.openspec.yaml` schema declaration.

#### Scenario: Existing schemas keep working

- **GIVEN** an existing change declares `schema: vision-driven` or `schema: spec-driven`
- **WHEN** OpenSpec loads that change after `vision2` is introduced
- **THEN** it resolves the change through its declared schema
- **AND** it does not require `interview_plan.md`, `toc.md`, or `issues/`

# vision-driven-openspec-workflow Specification

## Purpose

Define Agenter's project-local OpenSpec workflow where visible/product intent drives specs, BDD tasks, implementation, and self-review loops.

## Requirements

### Requirement: Vision-driven schema SHALL make intent the first artifact

The project SHALL provide a project-local OpenSpec schema named `vision-driven`. Its first artifact SHALL be `research-plan`, and that artifact SHALL generate `plans/plan.md` as the single current Intent Document. The research-plan stage MAY use change-local demo/spike code under `demos/` to collapse vague requirements before specs are hardened.

#### Scenario: New change starts from intent

- **GIVEN** the project default OpenSpec schema is `vision-driven`
- **WHEN** a new change is created without an explicit schema override
- **THEN** OpenSpec assigns schema `vision-driven`
- **AND** the first ready artifact is `research-plan`
- **AND** the output path for that artifact is `plans/plan.md`
- **AND** any demo/spike code used during intent research remains change-local under `demos/`

### Requirement: Vision-driven workflow SHALL derive specs and tasks from intent

The `vision-driven` schema SHALL require specs after `research-plan`, and tasks after specs. Tasks SHALL remain checkbox-trackable by OpenSpec apply instructions and SHALL include BDD work that traces back to the Intent Document.

#### Scenario: Specs and tasks are dependency ordered

- **GIVEN** a `vision-driven` change has no artifacts yet
- **WHEN** OpenSpec reports artifact status
- **THEN** `specs` is blocked by `research-plan`
- **AND** `tasks` is blocked by `specs`
- **AND** apply tracking uses `tasks.md`

### Requirement: Self-review SHALL be an explicit workflow artifact

The `vision-driven` schema SHALL include a `self-review` artifact that generates `review/self-review.html`. The self-review artifact SHALL compare output against `plans/plan.md`, specs, and tasks, and SHALL record deviations plus user-confirmation questions.

#### Scenario: Review produces a presentation artifact

- **GIVEN** a `vision-driven` change has completed tasks
- **WHEN** self-review is requested
- **THEN** the review output path is `review/self-review.html`
- **AND** the report includes deviation and user-question sections

### Requirement: Controller SHALL enforce revision and review loop mechanics

The repository SHALL provide a controller entrypoint for workflow mechanics not expressible in OpenSpec schema metadata. The controller SHALL support backing up `plans/plan.md` to the next `plans/plan-vN.md`, recording review iteration state, signaling repeated issues after 2 occurrences, and checking required workflow artifacts.

#### Scenario: Plan backup preserves the current SSOT before revision

- **GIVEN** `plans/plan.md` already exists for a change
- **WHEN** the controller backs up the plan
- **THEN** the current plan is copied to the first available `plans/plan-vN.md`
- **AND** the current `plans/plan.md` remains the SSOT path for the next revision

#### Scenario: Repeated review issue routes back to research-plan

- **GIVEN** the same review issue has been recorded once
- **WHEN** the controller records that issue again
- **THEN** it reports the issue as repeated
- **AND** it exits with a non-zero loop-back signal

### Requirement: Existing spec-driven changes SHALL remain valid

Changing the project default schema to `vision-driven` SHALL NOT rewrite existing changes that explicitly declare `schema: spec-driven` in `.openspec.yaml`.

#### Scenario: Existing change metadata keeps old workflow

- **GIVEN** an existing change has `.openspec.yaml` with `schema: spec-driven`
- **WHEN** OpenSpec loads status for that change after the default schema changes
- **THEN** it resolves the change through `spec-driven`
- **AND** it does not require `plans/plan.md` or `review/self-review.html`

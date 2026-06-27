## MODIFIED Requirements

### Requirement: Self-review SHALL separate reasoning from presentation

The `vision-driven` schema SHALL include a `self-review` artifact that generates `review/self-review.md` as the macro-level review reasoning record. The self-review stage SHALL also require a separate `review/self-review.html` presentation report for screenshots, interaction evidence, and structured review information. The self-review artifact SHALL compare output against `plans/plan.md`, specs, and tasks, and SHALL record deviations plus user-confirmation questions. The HTML report SHALL stay structured enough for humans to inspect, but the checker SHALL NOT require a rigid section taxonomy.

#### Scenario: Review produces reasoning and presentation artifacts

- **GIVEN** a `vision-driven` change has completed tasks
- **WHEN** self-review is requested
- **THEN** the OpenSpec artifact output path is `review/self-review.md`
- **AND** `review/self-review.md` includes review state, deviations, user-confirmation questions, and evidence reasoning
- **AND** `review/self-review.html` exists as a separate structured evidence presentation

### Requirement: Controller SHALL enforce revision and review loop mechanics

The repository SHALL provide a controller entrypoint for workflow mechanics not expressible in OpenSpec schema metadata. The controller SHALL support backing up `plans/plan.md` to the next `plans/plan-vN.md`, recording review iteration state in `review/state.json` when the review enters a real loop, signaling repeated issues after 2 occurrences, and checking required workflow artifacts. The `check` command SHALL validate artifact presence and minimal format sanity, but SHALL NOT reject free-form self-review Markdown or HTML just because either layer does not match a fixed layout.

#### Scenario: Free-form review layers are accepted

- **GIVEN** a `vision-driven` change has `plans/plan.md`, `tasks.md`, `review/self-review.md`, and `review/self-review.html`
- **WHEN** the controller runs `check`
- **THEN** it does not reject the review solely because the Markdown or HTML layout differs from the template

#### Scenario: Optional review state is validated when present

- **GIVEN** a `vision-driven` change includes `review/state.json`
- **WHEN** the controller runs `check`
- **THEN** the state file must be structurally valid for that change

## MODIFIED Requirements

### Requirement: Self-review SHALL be an explicit workflow artifact

The `vision-driven` schema SHALL include a `self-review` artifact that generates `review/self-review.html`. The self-review artifact SHALL compare output against `plans/plan.md`, specs, and tasks, and SHALL record deviations plus user-confirmation questions. The HTML report SHALL stay structured enough for humans to inspect, but the checker SHALL NOT require a rigid section taxonomy.

#### Scenario: Review produces a structured but flexible presentation artifact

- **GIVEN** a `vision-driven` change has completed tasks
- **WHEN** self-review is requested
- **THEN** the review output path is `review/self-review.html`
- **AND** the report includes review state, deviations, user-confirmation questions, and evidence in whatever HTML structure best communicates the review

### Requirement: Controller SHALL enforce revision and review loop mechanics

The repository SHALL provide a controller entrypoint for workflow mechanics not expressible in OpenSpec schema metadata. The controller SHALL support backing up `plans/plan.md` to the next `plans/plan-vN.md`, recording review iteration state in `review/state.json` when the review enters a real loop, signaling repeated issues after 2 occurrences, and checking required workflow artifacts. The `check` command SHALL validate artifact presence and minimal format sanity, but SHALL NOT reject free-form self-review HTML just because it does not match a fixed layout.

#### Scenario: Free-form review HTML is accepted

- **GIVEN** a `vision-driven` change has `plans/plan.md`, `tasks.md`, and `review/self-review.html`
- **WHEN** the controller runs `check`
- **THEN** it does not reject the review solely because the HTML layout differs from the template

#### Scenario: Optional review state is validated when present

- **GIVEN** a `vision-driven` change includes `review/state.json`
- **WHEN** the controller runs `check`
- **THEN** the state file must be structurally valid for that change

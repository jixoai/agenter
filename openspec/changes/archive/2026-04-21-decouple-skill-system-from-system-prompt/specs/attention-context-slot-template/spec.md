## ADDED Requirements

### Requirement: Attention contexts SHALL render immutable slot templates
The attention system SHALL model each context as an immutable template plus mutable named slot bodies. The rendered context snapshot SHALL be derived from the template and current slot values rather than stored as an independent source of truth.

#### Scenario: Context without an explicit template uses the default slot template
- **WHEN** the runtime creates an attention context without providing a template
- **THEN** the context template becomes `<Slot name="default"/>`
- **AND** the context contains a writable `default` slot
- **AND** the rendered content equals the `default` slot body

#### Scenario: Rendered context concatenates declared slots in template order
- **WHEN** a context template contains multiple `<Slot />` declarations
- **THEN** the rendered context concatenates the resolved slot bodies in template order
- **AND** a missing slot name renders as an empty string instead of failing silently

### Requirement: Ordinary attention commits SHALL target writable slots
An ordinary attention commit SHALL mutate only one named writable slot at a time. If `target` is omitted, the system SHALL treat it as `default`.

#### Scenario: Omitted target writes the default slot
- **WHEN** an `attention_commit` omits `target`
- **THEN** the system applies the change to the `default` slot
- **AND** the rendered context is recomputed from the immutable template

#### Scenario: Unknown target slot is rejected
- **WHEN** an `attention_commit` targets a slot name that is not declared by the context template
- **THEN** the commit is rejected
- **AND** the context head, slot bodies, and rendered content remain unchanged

#### Scenario: Readonly target slot is rejected for ordinary commits
- **WHEN** an ordinary `attention_commit` targets a slot declared with `readonly`
- **THEN** the commit is rejected
- **AND** the readonly slot body remains unchanged

### Requirement: Runtime-owned systems SHALL update readonly slots through internal slot setters
Readonly slots SHALL be writable only through explicit runtime-internal slot setters rather than ordinary public attention commits.

#### Scenario: Skill system refreshes the readonly skills-list slot
- **WHEN** the runtime skill system publishes a refreshed skill snapshot
- **THEN** it updates the readonly `skills-list` slot through the internal setter
- **AND** the context rendered content is recomputed
- **AND** no ordinary public commit privilege flag is required

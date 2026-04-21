## MODIFIED Requirements

### Requirement: Context owns mutable attention state
The system MUST model each attention context as mutable state with a stable `contextId`, immutable `template`, mutable named slot bodies, current rendered content, current score map, `headCommitId`, and durable focus state. `content` SHALL remain the derived render result so projections can read the final snapshot without becoming owners of slot composition.

#### Scenario: Context without explicit template starts from the default slot surface
- **WHEN** the runtime creates an attention context without an explicit template
- **THEN** the context template becomes `<Slot name="default"/>`
- **AND** the context starts with a writable `default` slot
- **AND** the rendered content equals the `default` slot body

#### Scenario: Context content is replaced by update commit on the targeted slot
- **WHEN** an `attention_commit` with `change.type = "update"` is applied to a writable target slot
- **THEN** the targeted slot body becomes the provided value
- **AND** the context rendered content is recomputed from the immutable template
- **AND** the context head advances to the new commit
- **AND** the context score map is updated using the commit score patch.

#### Scenario: Context focus state changes without rewriting template or slot bodies
- **WHEN** the system changes an attention context from `focused` to `background`, `muted`, or back again
- **THEN** the context preserves its immutable template, current slot bodies, and score map
- **AND** the updated context state records the new focus state as durable attention state
- **AND** later ingress routing uses that focus state as the canonical focus signal

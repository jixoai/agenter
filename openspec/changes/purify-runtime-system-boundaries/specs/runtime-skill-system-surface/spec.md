## ADDED Requirements

### Requirement: Runtime skill refresh SHALL maintain a capability index and standard attention-item path by default

Runtime skill refresh SHALL maintain queryable skill truth, fingerprint baselines, and watcher invalidation state without making the skill system a permanent task context by default. If change publication is enabled, the default publication path SHALL be an ordinary objective attention item rather than a dedicated skill-only context.

#### Scenario: Skill refresh updates index without task context
- **WHEN** runtime refreshes visible skills during boot or collection
- **THEN** `skill list`, `skill search`, `skill info`, and skill snapshot truth reflect the current index
- **AND** runtime does not create or select `ctx-skill-system` or another dedicated skill-only attention peer solely because refresh occurred

#### Scenario: Changed skill publishes ordinary attention item only
- **WHEN** a visible skill file changes and notification policy allows publication
- **THEN** runtime emits an ordinary objective attention item describing the changed skill name, root kind, and changed files
- **AND** runtime does not synthesize a dedicated skill-system context solely because the files changed

#### Scenario: Skill body is fetched on demand
- **WHEN** the model needs details for a skill
- **THEN** it calls the skill query surface such as `skill info`
- **AND** the runtime does not inject all skill bodies into default task context

### Requirement: Skill change notification SHALL be objective and explicitly scoped

Skill file changes MAY publish objective notifications when configured by the runtime law, but those notifications SHALL describe index changes and SHALL NOT masquerade as task obligations unrelated to current work.

#### Scenario: Changed skill notification is objective
- **WHEN** a visible skill file changes and notification policy allows publication
- **THEN** runtime emits a fact describing the changed skill name, root kind, and changed files
- **AND** the fact does not instruct the model to rewrite its current task unless the model explicitly chooses to inspect it

#### Scenario: Irrelevant skill churn does not preempt task work
- **WHEN** a skill file changes while the model is working on an unrelated room or terminal task
- **THEN** scheduler policy may record the index change
- **AND** the current task is not replaced by a skill-system task context by default

### Requirement: Skill bootstrap SHALL be explicit or objective-dependency-driven

Runtime skill bootstrap content SHALL enter model work only when explicitly requested, explicitly mounted, or already objectively required by active work. Hidden special supply paths SHALL NOT inject a dedicated skill context by default.

#### Scenario: Explicit skill query enters decision surface
- **WHEN** the model calls `skill list`, `skill search`, `skill info`, or `skill get-config`
- **THEN** the returned skill projection enters the current decision surface as tool/action result

#### Scenario: Explicit mount can bring skill content into work
- **WHEN** an operator, model action, or already-objective task dependency explicitly mounts a skill body or skill snapshot
- **THEN** that mounted content may enter the current decision surface
- **AND** the supply path remains inspectable as an explicit query, mount, or dependency

#### Scenario: Default bootstrap does not include permanent skill task
- **WHEN** a model call is prepared for ordinary room or terminal work
- **THEN** the runtime does not include a permanent or dedicated skill-system attention context unless the current work has already reached it through an explicit standard supply path

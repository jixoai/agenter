## MODIFIED Requirements

### Requirement: LoopBus SHALL provide an attention-first plugin pipeline

The runtime SHALL expose an attention-first plugin pipeline where external systems integrate by registering plugins, source adapters, egress adapters, and stable lifecycle hooks around attention loading, transformation, scheduling, model calls, and effect dispatch.

#### Scenario: Deferred attention refs stay invalidated until the load gate opens

- **WHEN** a plugin denies `attentionShouldLoad` for an invalidated source ref
- **THEN** that ref is not converted into attention drafts in the current round
- **AND** the runtime keeps the ref invalidated for the next eligible round instead of dropping it

### Requirement: LoopBus hooks SHALL use explicit execution kinds

Each LoopBus hook type SHALL define a stable execution kind such as `first`, `sequential`, `parallel`, or `sequential-waterfall`, and plugin registration SHALL preserve those semantics consistently across ingress and egress phases.

#### Scenario: The attention load gate stops at the first authoritative decision

- **WHEN** multiple plugins participate in `attentionShouldLoad`
- **THEN** the runtime accepts the first non-null authoritative decision
- **AND** later handlers are not invoked for that source ref

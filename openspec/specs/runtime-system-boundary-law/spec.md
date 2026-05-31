# runtime-system-boundary-law Specification

## Purpose

Define the shared runtime boundary vocabulary so every runtime system integrates through the same explicit fact, projection, scheduler, action, and effect law.

## Requirements

### Requirement: Runtime systems SHALL publish through four explicit channels

Every runtime system adapter SHALL classify its output as `WorldFact`, `CapabilityProjection`, `SchedulerSignal`, or `AgentAction` / `EffectLedger` before that output reaches the shared runtime kernel. The kernel SHALL NOT accept source-specific blobs that require kernel-level business interpretation.

#### Scenario: Message fact enters as a world fact

- **WHEN** a room receives a new durable message
- **THEN** the message adapter emits a `WorldFact` containing objective room-message fields
- **AND** the kernel does not infer whether the message requires a reply

#### Scenario: Room snapshot enters as a projection

- **WHEN** the model or UI requests room participants, presence, or visible-room summaries
- **THEN** the message system returns a `CapabilityProjection`
- **AND** that projection is not treated as a new task obligation by default

#### Scenario: Workspace CLI availability enters as a projection

- **WHEN** WorkspaceSystem evaluates a workspace instance env such as `AVATAR_HOME` or `SKILLS_HOME`
- **THEN** systems may publish available CLI bindings as `CapabilityProjection`
- **AND** adding or removing that projected CLI binding does not itself create a message, terminal input, file write, note entry, or other external effect

#### Scenario: Terminal idle enters as a scheduler signal

- **WHEN** a terminal transitions from busy to idle
- **THEN** the terminal adapter may emit a `SchedulerSignal`
- **AND** the signal may wake or rank model work without becoming task content

#### Scenario: Message send records an explicit effect

- **WHEN** the model calls `message send`
- **THEN** the runtime records an `AgentAction` and the resulting room-row mutation in the effect ledger
- **AND** the visible room mutation is attributable to that explicit action

### Requirement: Soft guidance SHALL remain guidance

Systems MAY expose etiquette, defaults, recommended playbooks, or preferred strategies, but those soft fields SHALL travel only through standard guidance/query supply paths. They SHALL NOT be upgraded into hidden obligations, hidden effects, or privileged dedicated task contexts.

#### Scenario: Guidance shapes choice without becoming obligation

- **WHEN** a system teaches a recommended acknowledgement style, preferred waiting strategy, or other playbook
- **THEN** the guidance may influence model choice as a soft field
- **AND** the runtime does not convert that guidance into an already-decided task obligation

#### Scenario: Guidance does not create a privileged context

- **WHEN** a system guidance source changes or is refreshed
- **THEN** the runtime may expose that change through the same standard attention-item or query pipeline used for other objective updates
- **AND** it does not synthesize a dedicated privileged task context solely because the guidance changed

### Requirement: Runtime SHALL forbid external side effects without explicit actions

The runtime MUST NOT mutate durable external world state on behalf of the model unless an explicit `AgentAction` or operator control requested that mutation.

#### Scenario: Tool work does not auto-send chat output

- **WHEN** the model starts `root_bash`, `workspace_bash`, terminal work, skill refresh, or any other non-message tool
- **THEN** the runtime does not send a room acknowledgement automatically
- **AND** the room transcript remains unchanged unless the model explicitly calls a message mutation

#### Scenario: Watch expiry does not mutate the world

- **WHEN** a delayed watch reaches its due time and its predicate still holds
- **THEN** the runtime emits only a reminder fact or scheduler signal
- **AND** it does not send, edit, recall, execute, or publish any external side effect automatically

### Requirement: Runtime source facts SHALL preserve Avatar-owned attention context by default

Runtime source ingress SHALL treat external facts, scheduler reminders, task changes, terminal observations, and room lifecycle records as attention item/detail facts unless the ingress explicitly declares that the target context is a source-owned projection. These commits SHALL preserve the current `attentionContext` content, slots, and content format while still updating commit history, head commit, and score state.

#### Scenario: Room reminder preserves topic summary

- **GIVEN** a room context contains an Avatar-authored topic summary
- **WHEN** a due follow-up reminder is emitted for that room
- **THEN** the reminder creates a queryable attention commit
- **AND** the room `attentionContext` content remains the Avatar-authored topic summary

#### Scenario: Room lifecycle preserves topic summary

- **GIVEN** a room context contains an Avatar-authored topic summary
- **WHEN** room lifecycle facts such as focus, update, archive, delete, or grant changes are committed
- **THEN** those lifecycle facts remain queryable in attention history
- **AND** the room `attentionContext` content remains the Avatar-authored topic summary

#### Scenario: Task and terminal facts preserve context summaries

- **GIVEN** task or terminal contexts contain Avatar-authored summaries
- **WHEN** task changes or terminal snapshots/diffs are committed from runtime source ingress
- **THEN** their detail payloads remain queryable through attention history
- **AND** the current `attentionContext` summaries remain unchanged

### Requirement: Runtime SHALL provide a generic one-shot watch primitive

The runtime SHALL provide a generic watch primitive for delayed re-evaluation. A watch SHALL be created by an explicit action, SHALL define a due time and objective predicate, and SHALL produce at most a new reminder fact or signal when due.

#### Scenario: Explicit action creates a delayed watch

- **WHEN** an explicit action requests a follow-up check with a delay and predicate
- **THEN** the runtime persists a one-shot watch owned by that action
- **AND** the watch remains inspectable through runtime diagnostics

#### Scenario: Due watch re-evaluates objective state

- **WHEN** the watch due time arrives
- **THEN** the runtime checks the predicate against world facts or capability projections
- **AND** it emits a reminder only if the predicate still holds

#### Scenario: Satisfied watch stays silent

- **WHEN** the watched world state has changed so the predicate no longer holds
- **THEN** the runtime marks the watch satisfied or expired
- **AND** it does not wake the model for a stale reminder

### Requirement: Effect ledger SHALL preserve action-to-effect causality

External side effects SHALL be traceable from an explicit action to the durable effect it produced. Runtime inspection surfaces SHALL be able to distinguish source facts, scheduler signals, and external effects.

The minimum durable contract for an effect-ledger entry in this cleanup SHALL include enough stable identity to reconstruct causality across runtime restarts and review tools. At minimum that means:

- `actionId`
- acting `actorId` or equivalent principal identity
- effect target identity
- effect record identity
- effect timestamp

When available for the triggering round, the same durable record SHALL also preserve the corresponding cycle/model-call linkage rather than relegating it to transient inspection-only memory.

#### Scenario: Room effect is causally linked

- **WHEN** a message action creates a durable room row
- **THEN** inspection can identify the action id, actor, target room, resulting message id, and cycle/model-call refs when available

#### Scenario: Effect causality survives restart

- **WHEN** the runtime is restarted after an explicit external effect was produced
- **THEN** later inspection can still resolve the durable action-to-effect link from persisted records
- **AND** the implementation does not rely on ephemeral in-memory inspection data to explain that causality

#### Scenario: Scheduler signal is not an effect

- **WHEN** focus, score, idle, timer, or backoff state changes
- **THEN** inspection reports that change as scheduler state
- **AND** it is not presented as an external side effect or model-authored action

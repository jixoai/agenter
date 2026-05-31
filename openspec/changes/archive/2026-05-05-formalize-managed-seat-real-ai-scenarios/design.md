## Context

Managed-seat handshake already established the platform law: invitation descriptors are projections, resource systems remain the authority owners, and acceptance activates resource-native access only after principal proof. The missing layer is the validation law that tells future tests and AI guidance how to prove those claims in realistic collaboration without collapsing back into prompt scripts like "say X, run Y, then expect wording Z".

This gap matters because managed seats are inherently cross-system:

- message rooms may transport a descriptor but do not own terminal authority
- HTTP wrapper links may help delivery but do not become the seat truth
- terminal and message keep resource-native grammars instead of one fake universal role model
- unilateral `config` and `revoke` are part of the authority law and must be observable in validation, not just unit-tested in isolation

The current practical precondition also matters: realistic managed-seat collaboration usually starts only after two principals already share a room. Until message-system contact discovery is formalized, this change should treat "shared room already exists" as explicit setup truth rather than hiding room bootstrap inside the same scenario.

## Goals / Non-Goals

**Goals:**

- Formalize a durable scenario catalog for managed-seat validation.
- Keep actor prompts and validation briefs situation-driven rather than command-prescriptive.
- Preserve projection-versus-authority law in every scenario topology.
- Require coverage for realistic collaboration and lifecycle archetypes, not just one golden-path demo.
- Define failure evidence that can distinguish prompt drift, harness weakness, authority bugs, and environment noise.

**Non-Goals:**

- Redesign managed-seat handshake, descriptor format, or resource-native authority grammar.
- Solve contact discovery, room bootstrap, or general social graph flows in this change.
- Freeze exact assistant wording, CLI spellings, or a single approved user prompt template.
- Force every future managed-seat validation to use one specific runtime or provider implementation.

## Decisions

### 1. Scenario catalog is a first-class contract, not an incidental test note

Managed-seat validation should be authored as structured scenario entries, each with:

- `setup`
- `objective`
- `invariants`
- `success`
- `failureEvidence`

This is the minimum structure needed to keep topology, user intent, and evaluator logic separated.

Why this over ad hoc test prose:

- the actor-facing brief stays natural
- the evaluator still has durable facts to assert
- the same scenario can later power deterministic integration tests, opt-in real-provider tests, and operator runbooks

Rejected alternative:

- Store scenarios only as freeform prompts in individual test files.
- Rejected because the prompt then becomes the hidden law, and every later CLI or wording change looks like a app regression even when authority behavior is still correct.

### 2. Validation prompts are situation briefs, not command recipes

The actor-facing material for a managed-seat scenario should describe:

- who is present
- which systems exist
- what the collaborator is trying to achieve
- what authority is already known or newly offered

It should not require:

- exact CLI spellings
- fixed message wording
- one hard-coded action order when multiple lawful paths exist

The evaluator must judge success by durable facts such as accepted seat state, visible terminal truth, or invalidated descriptor outcome.

Rejected alternative:

- Encode "use `terminal-manage invite`, send the returned link, then run `terminal-manage accept`" as the scenario itself.
- Rejected because that turns today's client projection into fake platform law and blocks future equivalent clients or prompt improvements.

### 3. Archetype coverage beats a single golden-path rehearsal

The catalog should require at least these scenario families:

- pair debugging
- temporary takeover for a fix
- teaching walkthrough
- room-routed invitation delivery
- unilateral post-accept config
- revoke or expiry invalidation
- management-capable handoff
- cross-instance collaboration

Why:

- pair debugging proves collaborative read/write on the same terminal truth
- temporary takeover proves a practical handoff under time pressure
- teaching walkthrough proves shared read plus controlled intervention instead of only "fix it for me"
- unilateral config / revoke / expiry prove containment law, not just happy-path onboarding
- management-capable handoff proves that admin-style seats still respect current-admin semantics
- cross-instance collaboration proves descriptors cross topology boundaries without re-homing authority

Rejected alternative:

- Keep only the existing one-room one-terminal demo and rely on ad hoc future tests for everything else.
- Rejected because the missing cases are exactly where authority, projection, and lifecycle law tend to rot.

### 4. Topology modeling stays separate from authority semantics

Each scenario should name its topology explicitly:

- same-instance room-routed collaboration
- same-instance lifecycle mutation
- cross-instance room transport with remote terminal authority

Topology facts are setup truth. Authority grammar remains resource-native truth. The scenario layer must not flatten these into one fake "share workflow".

Rejected alternative:

- Treat all transports, links, and backends as one generic collaboration surface.
- Rejected because it hides the most important architectural boundary: projection can move, authority ownership cannot.

### 5. Failure evidence must explain both law regressions and environment heat

Managed-seat validation failures should capture:

- recent room truth
- recent seat or invitation state transitions
- descriptor source and parsed projection form
- terminal observations from both sides
- accept/config/revoke/expiry timing facts
- relevant process and port ownership facts when local services are involved

This keeps the system diagnosable when the failure is caused by:

- prompt drift
- seat lifecycle bugs
- projection parsing bugs
- local process leakage or port conflicts

Rejected alternative:

- Rely only on semantic pass/fail judgment or final user-visible output.
- Rejected because seat lifecycle bugs and environment interference often look identical from the outer transcript alone.

### 6. Shared-room precondition remains explicit until contact discovery is formalized

The validation contract should state plainly that most scenarios begin with "two principals already share a room". That is not a flaw in the scenario catalog; it is an honest boundary between managed-seat validation and future contact/discovery work.

Rejected alternative:

- Hide room creation or contact establishment inside every managed-seat scenario.
- Rejected because it couples two different platform laws and makes failures harder to localize.

## Risks / Trade-offs

- [Risk] A scenario catalog can quietly turn into a global workflow engine. -> Mitigation: keep the schema minimal and focused on validation, not orchestration.
- [Risk] Natural-language briefs can still drift toward overfitting by habit. -> Mitigation: judge success by durable facts and review scenarios for command-prescriptive wording.
- [Risk] Cross-instance validation will be slower and more failure-prone than same-instance flows. -> Mitigation: keep topology layers explicit and allow cheaper same-instance coverage to catch most regressions first.
- [Risk] Requiring many archetypes may delay initial automation. -> Mitigation: treat the catalog as the durable contract first, then implement scenarios incrementally by priority.
- [Risk] Room bootstrap being out of scope can look incomplete to readers. -> Mitigation: make the precondition explicit and point future discovery/contact work to a separate change.

## Migration Plan

1. Add the new managed-seat validation capability spec and scenario catalog contract.
2. Encode the required archetypes in future scenario fixtures or harness metadata rather than in prompt-only prose.
3. Implement at least one same-instance room-routed scenario and one cross-instance scenario against the new contract.
4. Add lifecycle mutation coverage for unilateral `config`, re-invite rotation, revoke, and expiry.
5. Reuse the same catalog in future contact/discovery validation once room bootstrap becomes a first-class capability.

## Open Questions

- Should the scenario catalog eventually become machine-readable data, or is spec-plus-test-code enough for the first implementation?
- Which archetypes should become required in the first real-provider test wave versus later expansion?
- Does management-capable handoff need both terminal `TM` and message `admin` variants in v1, or is one resource enough to establish the law?

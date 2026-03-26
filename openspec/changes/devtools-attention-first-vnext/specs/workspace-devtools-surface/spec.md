## MODIFIED Requirements

### Requirement: Workspace Devtools SHALL own technical session inspection
The WebUI SHALL provide a dedicated Devtools route for technical session inspection, and that route SHALL own attention-context, cycle-frame, model-call, trace, terminal, and task inspection details that are not part of the default Chat narrative. The route SHALL use attention as the primary architecture concept and keep compact technical density suitable for expert reading.

#### Scenario: Devtools opens as the technical inspection surface
- **WHEN** the user opens the Devtools route for a workspace session
- **THEN** the route exposes technical inspection panels for the active session instead of conversation-first chat content
- **THEN** the primary navigation reflects attention-first concepts rather than a LoopBus-first narrative

#### Scenario: Cycle inspection stays subordinate to the attention model
- **WHEN** the active session contains persisted or active cycle frames
- **THEN** Devtools exposes them as a time-oriented inspection view linked to contexts, model calls, and trace
- **THEN** those details remain available without redefining cycles as the runtime's primary concept

### Requirement: Workspace Devtools SHALL expose a cycle-oriented inspection view
The WebUI SHALL expose a Devtools view that allows the user to inspect cycle frames and their related attention references, model work, and merged tool traces without relying on `inputs / facts / reply` sections.

#### Scenario: Cycle inspection shows attention refs and technical records
- **WHEN** the active session contains persisted or active cycle frames
- **THEN** Devtools exposes a cycle-oriented view that shows related context refs, item refs, model-call summaries, and egress outcomes
- **THEN** the detail view does not depend on legacy flattened fact buckets to remain useful

#### Scenario: Large structured attention payloads stay readable
- **WHEN** a selected cycle references a large structured attention payload such as dozens of items
- **THEN** Devtools renders those items through readable list-based structured previews
- **THEN** raw JSON remains available as an expert fallback instead of the default presentation

### Requirement: Devtools SHALL keep technical panels independently operable
The WebUI SHALL keep Devtools as the dedicated technical inspection surface, and its attention, cycle, model, trace, terminal, and task panels SHALL remain independently operable with isolated subscriptions, explicit loading states, and route-local scroll ownership.

#### Scenario: Active panel subscriptions stay isolated
- **WHEN** the user views one heavy Devtools panel while other panels remain inactive
- **THEN** only the active panel subscribes to its hot runtime slices and derived view-models
- **THEN** inactive panels do not retain unnecessary projection or render work

#### Scenario: Technical panels preserve compact scroll behavior
- **WHEN** the user browses long technical records in Devtools
- **THEN** each panel keeps an explicit primary scroll viewport for its own long content
- **THEN** headers and tab chrome remain outside the scrolled content region

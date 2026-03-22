## MODIFIED Requirements

### Requirement: Devtools SHALL keep technical panels independently operable
The WebUI SHALL keep Devtools as the dedicated technical inspection surface, and its cycle, LoopBus, and model-facing panels SHALL remain independently operable within that route instead of relying on one oversized mixed-responsibility panel.

#### Scenario: LoopBus tabs remain independently operable
- **WHEN** the user opens the LoopBus surface inside Devtools
- **THEN** the flow, trace, and model tabs remain independently operable
- **THEN** changing one tab's rendering details does not require restructuring the rest of the Devtools route

#### Scenario: Technical panels preserve compact scroll behavior
- **WHEN** the user browses long technical records in Devtools
- **THEN** each technical panel keeps an explicit primary scroll viewport for its own long content
- **THEN** headers and tab chrome remain outside the scrolled content region

#### Scenario: Inactive tabs do not keep heavy runtime subscriptions alive
- **WHEN** the user views one Devtools tab while other tabs remain inactive
- **THEN** only the active tab subscribes to its heavy runtime slices and derived view-models
- **THEN** inactive tabs do not retain model/API stream work or hot list projections unnecessarily

### Requirement: Devtools SHALL expose a cycle-oriented inspection view
The WebUI SHALL expose a Devtools view that allows the user to inspect session cycles and related factual inputs or internal assistant records without requiring those facts to appear in the default Chat flow.

#### Scenario: Cycle inspection shows collected facts and internal records
- **WHEN** the active session contains persisted or active cycles
- **THEN** Devtools exposes a cycle-oriented view that shows cycle identity and related factual inspection content such as collected inputs or internal assistant records
- **THEN** those details remain available even though they are no longer the default structure of Chat

#### Scenario: Large structured fact lists stay readable
- **WHEN** a cycle fact contains a large structured payload such as dozens of attention items
- **THEN** Devtools renders the payload as structured list items with a YAML-first preview instead of one markdown dump
- **THEN** raw JSON remains available through the viewer menu for exact inspection

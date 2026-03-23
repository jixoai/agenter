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
- **THEN** only the active tab subscribes to its heavy runtime slices and derived view-models unnecessarily
- **THEN** inactive tabs do not retain model/API stream work or hot list projections unnecessarily

### Requirement: Devtools long-history panels SHALL use the shared reverse-time loading model
Cycle, LoopBus, Terminal Activity, and Model history panels SHALL all expose the same older-page loading semantics instead of bespoke list contracts.

#### Scenario: Panels share one older-page contract
- **WHEN** the user loads older data in different Devtools panels
- **THEN** each panel uses the same `hasMoreBefore` / `loadingOlder` semantics
- **THEN** panel-specific rendering can change without redefining paging behavior

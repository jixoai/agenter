## ADDED Requirements

## MODIFIED Requirements

### Requirement: Runtime clients SHALL publish one Heartbeat record resource family

The runtime client SHALL hydrate, merge, and republish one session-local Heartbeat record resource family backed by the Heartbeat record projection and realtime invalidation. That family SHALL include exact count/page facts for the list surface, page-anchor state, and separately addressable record detail. The Heartbeat surface SHALL no longer depend on browser-side regrouping of raw `heartbeat`, `heartbeat_part`, `request_aux`, chat, or model-call histories just to construct the list view.

#### Scenario: Cold hydration loads count and latest record page together

- **WHEN** the operator opens a runtime route from a cold browser state
- **THEN** the runtime client hydrates the session's Heartbeat count, the latest record page window, and anchor state from the Heartbeat record contract
- **AND** the selected Heartbeat surface receives record rows rather than three independently merged history slices

#### Scenario: Live record updates merge by record identity or invalidate fixed history honestly

- **WHEN** the runtime durably records a new or updated Heartbeat source fact for an already hydrated session
- **THEN** the runtime publishes a realtime invalidation or patch scoped to the affected record identity
- **AND** the latest anchored page can merge that update in place
- **AND** a fixed historical page remains pinned and instead receives `newRecordsAvailable` state when newer records landed elsewhere

### Requirement: Runtime clients SHALL publish Heartbeat record pages and detail separately

Runtime inspection consumers SHALL read Heartbeat through bounded record pages plus separate record detail instead of one grouped-stream payload that must serve both list and full inspection. The recent record page SHALL be served from bounded `heartbeat_record` reads, while detail SHALL resolve from record source refs or a detail projection derived from those refs. Historical page queries SHALL not rebuild the entire session grouping graph for every pagination request.

#### Scenario: Recent record pages are served from bounded record reads

- **WHEN** the operator opens Heartbeat for a session with deep history
- **THEN** the backend reads only the `heartbeat_record` window needed for the requested page plus minimal count metadata
- **AND** it does not regroup the full session before returning the recent page

#### Scenario: Detail resolves separately from source-backed evidence

- **WHEN** the operator selects one record for deeper inspection
- **THEN** the runtime fetches detail by record identity
- **AND** that detail resolves full structured content from source refs or a dedicated detail projection
- **AND** the list page payload does not need to inline the same long bodies

### Requirement: Runtime clients SHALL publish Heartbeat record resource state explicitly

The runtime client SHALL expose Heartbeat record publication as explicit cached resources for count/page, anchor state, and selected detail, each with explicit `loading`, `loaded`, `refreshing`, `error`, and `data` facts as appropriate. Heartbeat consumers SHALL no longer infer load truth from whether the current row array happens to be empty or whether a detail panel happens to be closed.

#### Scenario: Cold list load is distinct from loaded empty

- **WHEN** a session runtime is hydrated from a cold browser state
- **THEN** the Heartbeat record page resource starts in an unloaded/loading state
- **AND** it transitions to loaded-empty, loaded-with-data, or error explicitly after the page request settles

#### Scenario: Warm page refresh and detail refresh stay independent

- **WHEN** a realtime invalidation refreshes an already loaded page while one detail panel is open
- **THEN** the runtime client can mark the page resource or detail resource as refreshing independently
- **AND** it preserves the warm page rows and current detail until fresher data or an error arrives

### Requirement: Runtime clients SHALL expose next-call config edits as Heartbeat config records

Heartbeat operators SHALL be able to change next-call model knobs from the Heartbeat surface without rewriting the current streaming call, and the resulting durable fact SHALL publish as a `config` record rather than as a transient browser-only pending row.

#### Scenario: Saving config emits a config record immediately

- **WHEN** the operator saves new `temperature`, `top-k`, `max tokens`, `thinking`, prompt-source, or similar next-call settings from the Heartbeat surface
- **AND** the active runtime is scoped to avatar-level durable settings
- **THEN** the save lands in the avatar settings layer instead of mutating `ai.providers.*`
- **AND** the Heartbeat record publication emits or refreshes a trailing `config` record immediately
- **AND** the currently streaming call, if any, keeps rendering with its original config snapshot

### Requirement: Runtime clients SHALL publish Heartbeat page-window anchor state explicitly

The Heartbeat publication contract SHALL expose page-window anchor state explicitly, including at least whether the current view is `latest` or `fixed`, the exact current page window, whether older or newer windows are reachable, and whether newer records arrived while the operator stayed on a fixed historical page.

#### Scenario: Latest anchor state stays objective

- **WHEN** the operator is viewing the latest record page
- **THEN** the runtime publication identifies that page as `latest`
- **AND** newer record inserts advance that window instead of creating an ambiguous stale state

#### Scenario: Fixed anchor state reports reachable newer data

- **WHEN** the operator pins a historical page window and newer records are later materialized
- **THEN** the runtime publication keeps the current window marked as `fixed`
- **AND** it reports `newRecordsAvailable` without silently moving the operator to another page

## REMOVED Requirements

## RENAMED Requirements

### Requirement: Runtime clients SHALL publish one Heartbeat message-parts slice
FROM: Runtime clients SHALL publish one Heartbeat message-parts slice
TO: Runtime clients SHALL publish one Heartbeat record resource family

### Requirement: Runtime clients SHALL project Heartbeat into grouped inspection pages
FROM: Runtime clients SHALL project Heartbeat into grouped inspection pages
TO: Runtime clients SHALL publish Heartbeat record pages and detail separately

### Requirement: Runtime clients SHALL publish grouped Heartbeat resource state explicitly
FROM: Runtime clients SHALL publish grouped Heartbeat resource state explicitly
TO: Runtime clients SHALL publish Heartbeat record resource state explicitly

### Requirement: Runtime clients SHALL expose next-call config edits as grouped Heartbeat facts
FROM: Runtime clients SHALL expose next-call config edits as grouped Heartbeat facts
TO: Runtime clients SHALL expose next-call config edits as Heartbeat config records

### Requirement: Runtime clients SHALL keep older-page loading attached to the top of the Heartbeat stream
FROM: Runtime clients SHALL keep older-page loading attached to the top of the Heartbeat stream
TO: Runtime clients SHALL publish Heartbeat page-window anchor state explicitly

# heartbeat-record-pagination Specification

## Purpose

Define the durable Heartbeat record projection that makes list pages countable, anchorable, and detailable without query-time regrouping.

## Requirements

### Requirement: Heartbeat pagination SHALL materialize a countable record index

The session runtime SHALL materialize operator-visible Heartbeat list truth into a dedicated `heartbeat_record` projection in `session.db`. Each row SHALL have stable record identity, deterministic ordering, and page-countable membership independent from query-time grouping. The projection SHALL be derived from objective source facts such as `message_part`, `ai_call`, and durable compact/config facts, and it SHALL NOT replace those source facts as the only durable truth.

#### Scenario: Stable total pages come from materialized records

- **WHEN** one session contains deep Heartbeat history
- **THEN** the system can return an exact record count and exact page count from `heartbeat_record`
- **AND** the recent page query does not need full-session regrouping before answering

#### Scenario: Record projection remains a projection rather than the only truth

- **WHEN** one record row is inspected
- **THEN** the row can be traced back to concrete `message_part`, `ai_call`, or effect facts
- **AND** those source facts remain queryable as the underlying evidence

### Requirement: Heartbeat record rows SHALL preserve bounded list data and source-ref-backed detail

Each `heartbeat_record` row SHALL carry only the bounded summary needed for list presentation, including at least stable key/identity, `kind`, `status`, `startedAt`, `updatedAt`, `completedAt`, ordered source refs, summary features, optional preview text, and related model-call identity when present. Full markdown bodies, reasoning bodies, tool inputs/results, JSON payloads, and long structured request facts SHALL remain detail-surface data resolved through source refs or dedicated detail projections rather than being duplicated wholesale into list rows.

#### Scenario: List rows stay bounded even when source content is large

- **WHEN** one source record contains long markdown, long reasoning, or large tool payloads
- **THEN** the corresponding record row still returns bounded summary fields
- **AND** page-window membership and row height are not determined by full detail payload size

#### Scenario: Detail reconstruction stays traceable to source refs

- **WHEN** the operator opens one record detail surface
- **THEN** the system resolves full structured content from the record's source refs or a detail projection built from those refs
- **AND** the detail response does not require the list page to inline the same long payloads

### Requirement: Heartbeat record classification SHALL be objective and deterministic

Top-level record kinds SHALL be `model_call`, `compact`, and `config`. `tool_call` and `tool_result` SHALL remain timed message-part features inside `model_call` records rather than independent record kinds. `pending` SHALL be modeled as open status or incomplete time range rather than as a kind. Classification rules SHALL be traceable to source facts and SHALL NOT invent semantic titles or summaries that were never emitted.

#### Scenario: Tool activity stays inside a model-call record

- **WHEN** one model-run fact window contains assistant tool calls and user tool results
- **THEN** the projection keeps those timed facts inside the same `model_call` record unless a later record boundary is objectively reached
- **AND** the system does not emit independent `tool` records just because tool activity exists

#### Scenario: Tool-result input boundary starts the next model-call record

- **WHEN** one durable `tool_result` ingress is followed by a new user-visible input boundary such as `UserMessage:textPart(commit-attention-items)`
- **THEN** the projection closes the previous `model_call` record at the tool boundary
- **AND** it starts a new `model_call` record for the next invocation window

### Requirement: Heartbeat model-call summaries SHALL use message-part timing as the primary axis

For `model_call` records, the projection SHALL preserve objectively observable start/end timing for message-part segments such as assistant `thinking`, assistant `text`, `tool_call`, and `tool_result`. The list summary SHALL support first-frame latency, collapsed middle timing statistics, tail-visible segment identity, tool-call counts, and an optional latest assistant text preview without inventing synthetic narrative titles.

#### Scenario: Missing assistant preview remains honestly empty

- **WHEN** one `model_call` record has no durable assistant `text` part suitable for preview
- **THEN** the record summary omits preview text
- **AND** the projection does not fabricate a fallback summary sentence

#### Scenario: Part timing supports collapsed middle statistics

- **WHEN** one `model_call` record contains many timed message parts
- **THEN** the summary can expose first-frame timing, collapsed middle thinking duration, and tool-call counts from those timings
- **AND** the operator does not need the detail surface just to know the timing outline

### Requirement: Heartbeat pagination SHALL support latest and fixed page-window anchors

The pagination contract SHALL support at least two anchor modes: `latest` and `fixed`. The `latest` anchor MAY move as new records arrive. A `fixed` page window SHALL remain pinned to its current page slice even when newer records are materialized. When a fixed window becomes stale because newer records arrived elsewhere, the system SHALL publish objective `newRecordsAvailable` state instead of silently moving the current window or stealing scroll position.

#### Scenario: Latest anchor follows new records

- **WHEN** the operator is viewing the latest anchored window and newer records are materialized
- **THEN** the latest page window advances to include those records
- **AND** the page count remains exact

#### Scenario: Fixed page window stays stable while newer records land

- **WHEN** the operator pins one historical page window and newer records are materialized
- **THEN** the current page window keeps the same page membership
- **AND** the operator's list anchor is not stolen by the newer records

#### Scenario: Fixed window exposes new-records-available state

- **WHEN** newer records land while one historical page window is fixed
- **THEN** the system publishes objective `newRecordsAvailable` state for that view
- **AND** the operator can decide when to jump back to the latest window

### Requirement: Heartbeat list and detail SHALL remain separate operator surfaces

The operator-facing Heartbeat experience SHALL treat the paginated record list and the full structured record detail as separate data and scroll surfaces. Selecting a record SHALL reveal detail without expanding neighboring list rows into unbounded height or forcing remeasurement of historical pages.

#### Scenario: Selecting detail does not change list-page membership

- **WHEN** the operator selects one record from a historical page
- **THEN** the surrounding list page keeps its current row identities and page membership
- **AND** selection does not trigger whole-page regrouping

#### Scenario: Detail can show full structured content without destabilizing the list

- **WHEN** the operator opens detail for one `model_call`, `compact`, or `config` record
- **THEN** the detail surface can render full structured content for that record
- **AND** the list row remains a bounded summary row

#### Scenario: Type-specific detail resources preserve list bounds

- **WHEN** the operator opens detail for `model_call`, `compact`, or `config`
- **THEN** the runtime provides enough selected-record detail data for the corresponding type-specific surface
- **AND** `model_call` detail can reconstruct step content from source refs
- **AND** `compact` detail can expose new/old context payloads and compact error state
- **AND** `config` detail can expose YAML diff, new config YAML, and old config YAML
- **AND** none of those long bodies need to be included in the list page rows

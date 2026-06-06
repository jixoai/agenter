## ADDED Requirements

## MODIFIED Requirements

### Requirement: Heartbeat SHALL default to a paged record list with separate detail

The `Heartbeat` tab SHALL default to a stable paginated record list backed by Heartbeat record truth, plus a separate structured detail surface for the currently selected record. The list SHALL show bounded rows with time, kind, status, model-call identity where available, adaptive summary graphics, and optional preview text. Full request facts, assistant segments, tool payloads, JSON bodies, compact deltas, and config changes SHALL live in the detail surface instead of expanding the list row into an unbounded transcript card.

#### Scenario: Heartbeat opens to the latest record page instead of one giant transcript

- **WHEN** the operator opens `Heartbeat` for a session that already recorded model runs, compacts, or config changes
- **THEN** the stage loads the latest record page as the primary list surface
- **AND** the operator can open one record's full structured detail without needing the whole session transcript to mount at once

#### Scenario: Live updates do not reflow historical record rows into transcript cards

- **WHEN** the runtime records new or updated Heartbeat facts while the operator is watching the list
- **THEN** only the affected record rows or the latest page membership change
- **AND** the operator does not need a single continuous transcript stream to understand the live Heartbeat state

#### Scenario: Heartbeat still reuses the outer runtime surface without another framed shell

- **WHEN** the operator opens the `Heartbeat` tab
- **THEN** the runtime body content sits flush inside the shared workbench body without route-local outer padding
- **AND** the Heartbeat stage does not add its own outer rounded border around the list/detail surfaces

### Requirement: Heartbeat SHALL anchor paged record windows and keep list/detail scroll ownership separate

The runtime Heartbeat surface SHALL treat page-window anchoring as a first-class interaction law. It SHALL support at least latest-follow and fixed historical page windows, and it SHALL keep the record list scroll surface independent from the selected-detail scroll surface. Returning from detail SHALL preserve the operator's current page window and list position.

#### Scenario: Fixed record page stays pinned while detail opens and closes

- **WHEN** the operator pins one historical record page and then opens or closes one selected record detail
- **THEN** the list keeps the same page membership and scroll position
- **AND** the detail surface gets its own scroll lifecycle

#### Scenario: Latest jump does not depend on transcript-local imperative scrolling

- **WHEN** the operator chooses to jump back to the latest page window
- **THEN** the Heartbeat stage switches the list anchor back to `latest`
- **AND** the operator does not need to rely on a long transcript scrollback just to reach current state

### Requirement: Heartbeat footer SHALL present objective runtime status and context details

The Heartbeat footer or its equivalent bottom chrome SHALL derive its primary status label from runtime scheduler containment facts rather than from frontend inference over the latest model-call row. The same chrome SHALL render context usage through the shared AI-elements `Context` composition, using the newest available model-call usage plus canonical provider metadata when that metadata exists. When provider metadata is incomplete, the footer SHALL keep the objective usage facts visible and SHALL disable, hide, or degrade the unavailable context details instead of inventing values. Anchor-mode or page-window status MAY appear in adjacent chrome, but it SHALL not become fake record rows.

#### Scenario: Scheduler truth drives the footer status label

- **WHEN** the runtime scheduler reports `running`, `waiting`, `backoff`, `blocked`, `paused`, or `idle`
- **THEN** the Heartbeat footer shows that objective containment state using scheduler facts such as `runtimeStatus` and `waitingReason`
- **AND** the UI does not label the state as `Waiting for AI call` solely because the latest model call is absent or not running

#### Scenario: Footer context uses the shared AI-elements surface

- **WHEN** the newest model call includes usage facts and the active provider exposes context metadata
- **THEN** the Heartbeat footer renders those facts through the shared AI-elements `Context` trigger/content structure
- **AND** the footer does not replace that contract with a bespoke local badge block

#### Scenario: Footer context falls back cleanly when provider metadata is incomplete

- **WHEN** the newest model call includes token usage but the active provider lacks `maxContextTokens` or pricing metadata
- **THEN** the Heartbeat footer still shows the available usage facts
- **AND** max-context progress or estimated cost stays disabled, hidden, or explicitly unavailable instead of inventing values

### Requirement: Heartbeat SHALL distinguish first-load, empty, refreshing, and error states

The `Heartbeat` tab SHALL project its list page, anchor state, and selected detail through explicit resource states rather than treating `no rows mounted` as the only empty condition.

#### Scenario: First load is not mistaken for an empty record list

- **WHEN** the operator opens `Heartbeat` before the first record page has loaded
- **THEN** the stage shows a loading state
- **AND** it does not show the `No Heartbeat records yet` empty-state copy until the list resource has actually loaded empty

#### Scenario: Warm refresh preserves visible list rows and current detail

- **WHEN** the record page resource is already loaded and a refresh is triggered by realtime invalidation or page navigation
- **THEN** the existing Heartbeat rows remain visible
- **AND** the selected detail remains mounted unless that selection itself changes
- **AND** the stage only adds a secondary refresh signal instead of clearing back to blank or empty state

### Requirement: Heartbeat bottom toolbar SHALL expose compact and config actions

The Heartbeat bottom toolbar SHALL expose a dedicated compact action and a dedicated next-call config action through explicit runtime control or settings paths rather than by inserting chat commands into the record list.

#### Scenario: Operator triggers compact from the bottom toolbar

- **WHEN** the operator clicks the compact action in the Heartbeat bottom toolbar
- **THEN** the runtime queues a manual compact request for that session
- **AND** the record list does not gain a fake `/compact` user message just to trigger the cycle

#### Scenario: Operator edits next-call config without mutating the active call

- **WHEN** the operator saves new next-call config from the Heartbeat bottom toolbar flow
- **THEN** the next-call settings change is recorded as Heartbeat fact for the upcoming invocation
- **AND** the currently streaming call, if any, keeps its original config snapshot

### Requirement: Heartbeat record list SHALL keep bounded rows while detail owns expansion

Heartbeat list virtualization or pagination SHALL preserve bounded record rows while delegating large structured expansion to the selected detail surface.

#### Scenario: Opening detail does not leave stale whitespace in the list

- **WHEN** the operator opens or closes detail for one record in the paged list
- **THEN** the list surface does not need disclosure-driven row-height remeasurement for every historical row
- **AND** the list does not retain stale whitespace from transcript-style expansion

### Requirement: Heartbeat compact records SHALL render as compression cards

The Heartbeat surface SHALL render a compact record as one compression-oriented card that keeps before/after context usage, reclaim duration, and compact-specific prompt facts inside the same semantic event.

#### Scenario: Compact card shows before and after context usage

- **WHEN** one compact record is visible in the Heartbeat list
- **THEN** the row renders compact as a compression card rather than as a generic transcript block
- **AND** the operator can scan before/after usage and reclaim duration from the row summary

#### Scenario: Compact detail reveals exact compact prompt facts in the same event

- **WHEN** the operator opens detail for that compact record
- **THEN** the same record reveals the compact system prompt, tool inventory, and other compact prompt facts
- **AND** the compact result stays inside that same chronological event

### Requirement: Heartbeat page-window controls SHALL keep latest and fixed anchors explicit

The Heartbeat list surface SHALL expose page-window navigation and anchor state explicitly. It SHALL make the distinction between `latest`, `fixed`, and `new records available` visible instead of hiding that state inside top-of-transcript load affordances.

#### Scenario: Fixed historical page advertises newer available records objectively

- **WHEN** the operator is pinned to a fixed historical page and newer records later arrive
- **THEN** the Heartbeat stage shows that newer records are available
- **AND** it does not silently jump away from the fixed page

#### Scenario: Latest anchor remains one explicit control path

- **WHEN** the operator returns from historical inspection to the newest Heartbeat state
- **THEN** the Heartbeat stage uses one explicit latest-anchor control path
- **AND** the operator does not need to scroll through the entire list to recover the current state

## REMOVED Requirements

## RENAMED Requirements

### Requirement: Heartbeat SHALL render one continuous message-parts runtime stream
FROM: Heartbeat SHALL render one continuous message-parts runtime stream
TO: Heartbeat SHALL default to a paged record list with separate detail

### Requirement: Heartbeat SHALL delegate transcript scrolling to the named anchored-scroll controller
FROM: Heartbeat SHALL delegate transcript scrolling to the named anchored-scroll controller
TO: Heartbeat SHALL anchor paged record windows and keep list/detail scroll ownership separate

### Requirement: Heartbeat footer SHALL expose manual compact as a control action
FROM: Heartbeat footer SHALL expose manual compact as a control action
TO: Heartbeat bottom toolbar SHALL expose compact and config actions

### Requirement: Heartbeat grouped virtualization SHALL remeasure disclosure-driven height changes
FROM: Heartbeat grouped virtualization SHALL remeasure disclosure-driven height changes
TO: Heartbeat record list SHALL keep bounded rows while detail owns expansion

### Requirement: Heartbeat compact cycles SHALL render as one special card
FROM: Heartbeat compact cycles SHALL render as one special card
TO: Heartbeat compact records SHALL render as compression cards

### Requirement: Heartbeat top paging SHALL keep one dedicated loading affordance
FROM: Heartbeat top paging SHALL keep one dedicated loading affordance
TO: Heartbeat page-window controls SHALL keep latest and fixed anchors explicit

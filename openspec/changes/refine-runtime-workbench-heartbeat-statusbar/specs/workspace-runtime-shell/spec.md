## ADDED Requirements

### Requirement: Runtime shell SHALL use shared workbench page-toolbar chrome

The runtime detail route SHALL derive its chrome from the shared `WorkbenchWindow + WorkbenchPageToolbar` contract instead of a runtime-local body header. Runtime title, runtime status, start/stop control, and runtime-tab-local chrome SHALL remain outside the scrollable page body.

#### Scenario: Runtime title and controls live in the page toolbar

- **WHEN** the operator opens a runtime route
- **THEN** the page toolbar shows the runtime title, avatar/workspace metadata, current runtime status, and the start/stop action
- **AND** the page body does not render a second stage header that repeats the same facts

#### Scenario: Runtime tabs keep body height for content

- **WHEN** the operator switches between `Heartbeat`, `Attention`, and `Settings`
- **THEN** each tab reuses the same toolbar chrome host for its title-level metadata and actions
- **AND** the main page body remains reserved for tab content rather than duplicated top chrome

#### Scenario: Runtime detail routes collapse avatar catalog meta chrome

- **WHEN** the operator opens a runtime or avatar-draft detail route inside the avatars workbench
- **THEN** the avatar catalog meta toolbar does not consume a second toolbar row above the runtime page
- **AND** the runtime page-toolbar remains the single durable toolbar row between the avatar tab strip and the detail body

#### Scenario: Shared page-toolbar never expands into multiple rows

- **WHEN** a workbench layout-level toolbar and a route-local `WorkbenchPageToolbar` both exist
- **THEN** the shared page-toolbar keeps its fixed single-row height
- **AND** the route-local portal content overrides the layout toolbar instead of stacking a second row

## MODIFIED Requirements

### Requirement: Heartbeat SHALL render one continuous message-parts runtime stream

The `Heartbeat` tab SHALL render one continuous runtime surface backed by durable `message-parts` truth. It SHALL show request-side auxiliary rows, AI-visible request/response rows, and compact boundaries in chronological order without rebuilding the primary story from mixed chat rows, request-aux cards, and model-call cards. The stream SHALL be hosted inside a virtualizable conversation container, and the stage SHALL expose a persistent footer statusbar for runtime context usage and attention-state summary.

#### Scenario: Heartbeat opens with folded auxiliary facts and durable AI-visible rows

- **WHEN** the operator opens `Heartbeat` for a session that already recorded `systemPrompt`, `tools`, `config`, request rows, response rows, or compact boundaries
- **THEN** the stage renders those rows from the durable Heartbeat `message-parts` stream in chronological order
- **AND** `systemPrompt`, `tools`, `config`, and `compact` rows are visually subordinate and collapsed by default
- **AND** AI-visible request/response rows remain readable as the primary stream content

#### Scenario: Heartbeat updates live without mixed inspection cards

- **WHEN** the runtime records a streamed assistant update or a new Heartbeat request row while the operator is watching the tab
- **THEN** the stage updates the affected durable Heartbeat row in place
- **AND** the operator does not need a separate model-call card to understand the live Heartbeat state

#### Scenario: Heartbeat keeps status signals outside the transcript

- **WHEN** the operator inspects the `Heartbeat` tab
- **THEN** the transcript scroll region ends above a fixed footer statusbar
- **AND** the footer can show the newest model-call usage context plus focused/background/muted attention counts without those signals becoming transcript rows

#### Scenario: Heartbeat virtualizes long runtime history without changing row semantics

- **WHEN** the durable Heartbeat stream contains a long message-part history
- **THEN** the stage virtualizes row mounting through its conversation container
- **AND** compact boundaries still render as boundary markers, tool activity still renders through the tool presentation, and thinking rows still render through reasoning presentation

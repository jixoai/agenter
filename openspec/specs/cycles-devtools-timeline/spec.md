# cycles-devtools-timeline Specification

## Purpose
TBD - created by archiving change build-chatapp-assets-and-cycle-devtools. Update Purpose after archive.
## Requirements
### Requirement: Devtools SHALL expose a live cycle timeline
The WebUI SHALL expose the cycle-oriented Devtools surface as a live timeline that summarizes cycle state, timing, and model/tool activity while the session is running, but that surface MUST keep its typography, density, and color hierarchy visually subordinate to the main Chat route.

#### Scenario: Active cycle appears in the live timeline
- **WHEN** the active session begins, collects, streams, or applies a cycle
- **THEN** the Devtools cycle timeline shows that cycle with live status updates
- **THEN** the user does not need to reload the panel to observe the latest cycle state

#### Scenario: Cycle timeline stays visually compact
- **WHEN** the user opens Devtools after using the conversation-first Chat route
- **THEN** the cycle timeline uses compact typography and restrained color emphasis
- **THEN** it reads as an expert inspection surface instead of competing with the Chat transcript

### Requirement: Cycle detail SHALL mount richer inspection on selection
The cycle timeline SHALL keep the list compact and mount richer cycle detail only for the selected cycle.

#### Scenario: Selecting a cycle opens detailed inspection
- **WHEN** the user selects a cycle from the timeline
- **THEN** the Devtools surface shows the related collected inputs, outputs, and model/tool summaries for that cycle in the detail region
- **THEN** the non-selected timeline rows remain lightweight

### Requirement: Long cycle history SHALL remain navigable
The Devtools cycle timeline SHALL remain operable for long-running sessions by virtualizing the timeline list and preserving stable selection behavior.

#### Scenario: Large cycle history keeps the panel responsive
- **WHEN** the session contains many historical cycles
- **THEN** the cycle timeline virtualizes the list instead of mounting every row at once
- **THEN** selection and scrolling remain responsive


## MODIFIED Requirements

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

## MODIFIED Requirements

### Requirement: Devtools SHALL keep expert tabs separate from Chat chrome
The WebUI SHALL keep its technical inspection tabs inside Devtools, and those tabs MUST NOT be duplicated as default disclosure inside the Chat route. The Devtools route SHALL keep its route tabs and panel header chrome fixed outside the active panel's primary scroll viewport.

#### Scenario: Technical tabs stay inside Devtools
- **WHEN** the user navigates between Devtools panels such as cycles, terminal, tasks, LoopBus, or model inspection
- **THEN** the application keeps those inspection affordances within the Devtools route
- **THEN** the Chat route does not duplicate the same technical panel hierarchy in its main surface

#### Scenario: Active technical panel owns the main scroll viewport
- **WHEN** the active Devtools panel contains content taller than the available viewport
- **THEN** that panel exposes one primary scroll viewport for its main content region
- **THEN** the route tabs and fixed panel chrome remain visible outside the scrolling region

## MODIFIED Requirements

### Requirement: Overflow ownership SHALL remain explicit for terminal renderer surfaces
Terminal renderer surfaces SHALL have one explicit scroll owner with visible scrollbar support, and embedding shells SHALL not wrap the renderer in competing nested scroll containers.

#### Scenario: Terminal surface owns the only active scrollbar
- **WHEN** a terminal renderer is embedded inside WebUI or another host
- **THEN** the renderer viewport owns one active scroll container
- **THEN** outer shells do not introduce a second competing vertical scroll area around the same terminal content

#### Scenario: Narrow viewport still keeps terminal scrolling usable
- **WHEN** the terminal renderer is displayed in a narrow viewport
- **THEN** terminal output remains scrollable with a visible scrollbar
- **THEN** the viewport does not clip the terminal body into a non-scrollable region

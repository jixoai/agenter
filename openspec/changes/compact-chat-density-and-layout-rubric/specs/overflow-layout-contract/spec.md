## MODIFIED Requirements

### Requirement: Workspace shell routes SHALL declare scroll ownership per route type
The WebUI SHALL declare scroll ownership per workspace route type instead of forcing Chat, Devtools, and Settings through one generic page-scrolling model. Shell scaffolds MAY size route regions, but they MUST NOT become the primary scroll owner for route content, and they MUST keep compact padding budgets from being duplicated across shell, route, and inner surface layers.

#### Scenario: Chat keeps transcript-specific scrolling
- **WHEN** the user opens a long Chat session
- **THEN** the transcript viewport owns message scrolling
- **THEN** outer shell wrappers only size the route stage

#### Scenario: Devtools and Settings keep panel-specific scrolling
- **WHEN** the user opens Devtools or Settings content taller than the route viewport
- **THEN** the active technical panel or settings pane owns scrolling for its own content
- **THEN** shared shell wrappers do not suppress that scrolling by adding competing overflow rules or padding stacks

#### Scenario: Compact routes avoid duplicate padding stacks
- **WHEN** a compact viewport renders shell chrome, route-local status, and the primary route surface together
- **THEN** only one layer owns the major route padding budget for that area
- **THEN** inner surfaces do not reintroduce a second large padding ring that makes the first viewport feel wasteful

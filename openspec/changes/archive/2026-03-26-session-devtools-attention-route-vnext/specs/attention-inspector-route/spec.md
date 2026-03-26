## MODIFIED Requirements

### Requirement: Devtools SHALL inspect attention contexts and items directly
Devtools SHALL expose attention as a top-level technical panel, and the context/item drill-down SHALL be owned by the attention detail pane instead of by top-level Devtools tabs.

#### Scenario: Attention detail tabs live in the right pane
- **WHEN** the user selects an attention context
- **THEN** the right-side detail pane appears for that context
- **AND** the `Context / Items` tabs are rendered inside that detail pane instead of at the top-level Devtools navigation layer

#### Scenario: Query commits is navigable state
- **WHEN** the user enters a commit query or clicks a score/hash traversal affordance
- **THEN** the route state records the selected context, detail view, and query text
- **AND** browser back/forward restores the same query-driven inspection state

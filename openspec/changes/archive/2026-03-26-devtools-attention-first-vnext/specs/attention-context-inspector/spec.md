## ADDED Requirements

### Requirement: Devtools SHALL inspect attention contexts and items directly
Devtools SHALL expose a dedicated inspection flow for attention contexts and their items, including owner metadata, active/resolved state, score vectors, and structured detail.

#### Scenario: Context list shows ownership and activity
- **WHEN** the session has one or more attention contexts
- **THEN** Devtools lists each context with its owner, identifier, and active item summary
- **THEN** the user can select a context without first opening a cycle row

#### Scenario: Item detail shows structured attention data
- **WHEN** the user selects an attention item in the inspector
- **THEN** Devtools shows its title, metadata, score vector, and detail payload in readable structured form
- **THEN** the inspector keeps raw inspection access without forcing JSON dumps as the default view

### Requirement: Attention inspection SHALL follow links across item evolution
The attention inspector SHALL let the user follow item relationships such as parent links, merged links, and shared score/hash relationships across contexts.

#### Scenario: Related items can be traversed from one selection
- **WHEN** an attention item references related hashes or linked items in another context
- **THEN** the inspector exposes those related items as navigable links
- **THEN** the user can inspect the downstream or upstream item without leaving Devtools

#### Scenario: Forks and merges remain visible
- **WHEN** an attention item was created from one or more parent items
- **THEN** the inspector shows the parent and child relationships for that item
- **THEN** the evolution of the work remains understandable beyond a single flat row

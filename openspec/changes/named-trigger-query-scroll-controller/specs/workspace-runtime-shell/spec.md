## MODIFIED Requirements

### Requirement: Heartbeat SHALL delegate transcript scrolling to the named anchored-scroll controller

The runtime Heartbeat surface SHALL consume the shared named trigger/query/controller runtime for grouped transcript scrolling. Latest follow, older reveal, load-older affordances, and scroll-to-latest affordances SHALL be driven through named triggers and an installed program instead of local imperative timeline control.

#### Scenario: Heartbeat scroll-to-latest is driven through the shared named runtime

- **WHEN** the operator activates Heartbeat's `Scroll to latest` affordance
- **THEN** the stage raises a named action trigger consumed by the installed program
- **AND** the stage does not directly issue a feature-local semantic viewport write

#### Scenario: Group prepend and append follow the named trigger program

- **WHEN** Heartbeat groups are prepended, appended, or replaced
- **THEN** the installed program derives the resulting scroll behavior from named query facts such as edge state, collection delta, and insert batches
- **AND** the grouped transcript does not keep a parallel local scroll controller path

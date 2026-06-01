## ADDED Requirements

### Requirement: Studio Heartbeat migration SHALL wait for example acceptance

The first `web-heartbeat-view` apply phase SHALL NOT migrate Studio to consume `@agenter/web-heartbeat-view`. The package SHALL remain designed so Studio can later consume it through a thin adapter after `@agenter/web-heartbeat-view:example` is accepted. Until that follow-up is approved, Studio's existing runtime Heartbeat route remains the source for Studio behavior, while the package owns the new standalone Heartbeat presentation law.

#### Scenario: First apply leaves Studio route behavior untouched

- **WHEN** the first package/example implementation is applied
- **THEN** Studio is not required to import `@agenter/web-heartbeat-view`
- **AND** the existing Studio runtime Heartbeat route is not rewritten as part of the first acceptance slice

#### Scenario: Package boundary remains migration-ready

- **WHEN** the standalone example is accepted and a later Studio migration is considered
- **THEN** dependency direction remains `apps/studio` importing `@agenter/web-heartbeat-view`
- **AND** `@agenter/web-heartbeat-view` does not import Studio feature files, Studio routes, or Studio stores

#### Scenario: Deferred migration records the drift risk

- **WHEN** first-phase implementation copies Studio Heartbeat code into the package
- **THEN** the change records that Studio migration is deferred by user decision
- **AND** any remaining Studio/package parser drift is treated as a follow-up migration risk rather than hidden first-phase scope

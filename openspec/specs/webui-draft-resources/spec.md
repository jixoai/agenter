# webui-draft-resources Specification

## Purpose
Define the durable draft resource law for resumable WebUI create and edit flows.

## Requirements

### Requirement: WebUI draft flows SHALL use auth-scoped typed draft resources
Long-lived create or edit drafts that need resume semantics SHALL use first-class auth-scoped draft resources rather than opaque KV entries or browser-local scratch payloads. Each draft resource SHALL have a stable draft id, a typed kind, durable body state, and lifecycle metadata such as version and update time.

#### Scenario: Draft resource is created before the route becomes durable
- **WHEN** the operator starts a resumable create flow
- **THEN** the backend mints a draft resource id under the authenticated actor before the route treats that flow as durable truth
- **AND** the route can re-resolve the same draft resource later by id

#### Scenario: Draft resource updates preserve stable identity
- **WHEN** the operator edits fields inside an existing draft flow
- **THEN** the backend keeps the same draft resource id while updating the durable draft state
- **AND** the resource exposes updated metadata so another client can resume the newer draft body

### Requirement: Closing local workbench presence SHALL not delete a draft resource
Draft resource lifecycle SHALL be separate from local workbench tab presence. Closing a local draft tab MUST remove only that device-local projection unless the operator explicitly discards the draft or completes the flow.

#### Scenario: Closing a draft tab keeps the resource durable
- **WHEN** the operator closes a draft tab without discarding it
- **THEN** the local workbench tab disappears from that device
- **AND** the durable draft resource remains available for later resume

#### Scenario: Submit or discard removes the durable draft resource
- **WHEN** the operator completes the flow or explicitly discards the draft
- **THEN** the system deletes the draft resource from the authenticated actor partition
- **AND** later resume attempts for that draft id fail as not found

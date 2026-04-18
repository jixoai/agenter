## ADDED Requirements

### Requirement: Avatar creation SHALL use durable draft resources instead of browser-local scratch truth

The global avatar creation flow SHALL treat the route draft id as a durable server-backed draft resource rather than as a browser-local scratch identifier. Draft form fields such as nickname and template source SHALL load from and save to that draft resource.

#### Scenario: Starting avatar creation creates a durable draft resource

- **WHEN** the operator starts a new avatar creation flow from the catalog
- **THEN** the backend creates an auth-scoped avatar-create draft resource and returns its draft id
- **AND** the workbench navigates to the avatar-create route using that durable draft id

#### Scenario: Avatar create route resumes from the draft resource

- **WHEN** the operator reopens an existing avatar-create route for the same draft id
- **THEN** the route hydrates nickname and template-source fields from the durable draft resource
- **AND** those values no longer depend on browser-local tab payload as the truth source

#### Scenario: Completing avatar creation clears the draft resource

- **WHEN** the operator successfully creates the avatar from a draft
- **THEN** the avatar creation flow deletes the durable draft resource
- **AND** the local draft tab closes without leaving stale draft truth behind

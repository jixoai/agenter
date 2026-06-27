## MODIFIED Requirements

### Requirement: Resource activation SHALL be parity across token and tile

Resource detail behavior SHALL be keyed by the resolved resource itself, not by where the operator clicked it from. Token and tile entrypoints SHALL expose stable accessible names so route-level proof can open them without relying on brittle Markdown text matching.

#### Scenario: Token and bar tile open the same detail surface

- **WHEN** the operator opens a resource from an inline token or from the in-bubble aggregated resource bar
- **THEN** both entry points resolve the same resource id
- **AND** they open the same preview or detail surface for that resource kind
- **AND** each entrypoint exposes a stable accessible activation label for route-level screenshot automation

#### Scenario: Resource kind selects the official viewer family

- **WHEN** the operator opens an image, document/video, or comment resource under a Framework7 runtime
- **THEN** all resource kinds use one shared popup/page preview shell
- **AND** image/video resources render a media stage inside that shell
- **AND** document/file resources render a document-detail stage inside that shell
- **AND** comment resources render a comment-detail stage inside that shell with explicit `view / edit` continuity

#### Scenario: Source-comment editing stays inside the Framework7 sheet safe area

- **WHEN** the operator creates or edits a comment from the source Markdown layer under a Framework7 runtime
- **THEN** the edit surface is owned by the Framework7 sheet family
- **AND** the sheet keeps cancel/save actions inside the visible safe area
- **AND** the editable textarea remains visible and usable instead of being pushed below or clipped by the sheet boundary

## MODIFIED Requirements

### Requirement: Product extensions SHALL clear selected runtime sessions through generic session authority

Product extensions SHALL be able to reset a product-selected Avatar's runtime session context through generic session authority. The product-extension runtime SHALL NOT add product-specific runtime identity axes or product-owned conversation databases to support this workflow.

#### Scenario: Product clears current Avatar runtime session

- **GIVEN** a product has selected Avatar `review-4` for workspace `/repo`
- **AND** a runtime session already exists for that Avatar and workspace
- **AND** another workspace also has a runtime session for Avatar `review-4`
- **WHEN** the product requests a runtime-session clear before attach
- **THEN** the extension flow uses the generic session delete or equivalent session reset authority
- **AND** the next ensure-runtime call creates or reuses only the canonical AvatarRuntime identity for Avatar `review-4`
- **AND** the other workspace's runtime session is not cleared

#### Scenario: Clear preserves Avatar assets

- **WHEN** product-extension runtime clears a selected Avatar runtime session
- **THEN** it does not delete the Avatar principal
- **AND** it does not delete nickname aliases, canonical prompt files, memory files, profile media, workspace files, room catalog entries, or terminal catalog entries as a side effect

#### Scenario: Core remains unaware of cli-shell flags

- **WHEN** cli-shell uses `--avatar`, `--create-avatar`, or `--clear-avatar`
- **THEN** product-extension runtime exposes only generic Avatar ensure and session clear operations
- **AND** core runtime modules do not branch on those cli-shell flag names

## ADDED Requirements

### Requirement: Runtime Note CLI projection SHALL consume package-owned NoteSystem APIs

Runtime CLI projection SHALL continue to decide whether `note` is available from the workspace env/capability layer, but the projected command implementation and capability helper SHALL come from `@agenter/note-system`. App-server MAY adapt workspace env facts into explicit package inputs, but app-server MUST NOT own NoteSystem command behavior.

#### Scenario: AVATAR_HOME gating remains a host projection

- **GIVEN** a workspace has empty `AVATAR_HOME`
- **WHEN** runtime CLI projections are computed
- **THEN** app-server withholds the `note` command
- **AND** no NoteSystem package write path is invoked

#### Scenario: Projected note command uses package implementation

- **GIVEN** a workspace has non-empty `AVATAR_HOME`
- **WHEN** runtime CLI projections include `note`
- **THEN** the command is created from `@agenter/note-system`
- **AND** app-server injects the current env parser rather than importing package code back into app-server internals

## MODIFIED Requirements

## REMOVED Requirements

## RENAMED Requirements

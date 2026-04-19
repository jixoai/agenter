## MODIFIED Requirements

### Requirement: Global avatar management SHALL keep one default operational surface while adding discover and source management
The global `Avatars` destination SHALL evolve from a fixed local-only catalog into a unified avatar directory. `My Avatars` SHALL remain the default operational landing surface, while `Discover` and `Sources` SHALL exist as peer surfaces for acquisition and source management. Runtime sessions and creation flows SHALL continue to open as addable tabs layered on top of that directory rather than replacing it.

#### Scenario: Avatars lands on My Avatars by default
- **WHEN** the user opens the global `Avatars` destination
- **THEN** the UI lands on `My Avatars` as the default operational surface
- **AND** the user does not land on `Discover` or `Sources` first unless they explicitly navigate there

#### Scenario: Discover and Sources remain reachable as peer surfaces
- **WHEN** the user is working inside the `Avatars` destination
- **THEN** the UI exposes `My Avatars`, `Discover`, and `Sources` as peer directory surfaces
- **AND** navigating among them does not destroy the operator's understanding that `My Avatars` is the runtime-first operational home

#### Scenario: Runtime and creation tabs do not replace the directory shell
- **WHEN** the user opens an avatar runtime or starts a new-avatar creation flow
- **THEN** the flow opens as its own addable tab layered on top of the `Avatars` directory
- **AND** the directory surfaces remain reachable instead of being replaced by the runtime or draft flow

## ADDED Requirements

### Requirement: My Avatars SHALL project installed-avatar provenance as a secondary fact
Installed avatars that originate from remote packages SHALL keep provenance visible inside `My Avatars`, but that provenance SHALL remain secondary to the runtime-first operational story.

#### Scenario: Installed avatar shows source as a secondary fact
- **WHEN** the operator inspects an installed avatar that originated from a subscribed source
- **THEN** `My Avatars` shows the avatar name as the primary identity
- **AND** it shows source provenance as a secondary fact rather than as a new dominant mode label

#### Scenario: Pure-local avatars remain first-class peers
- **WHEN** the operator scans `My Avatars` and some avatars were never installed from any remote source
- **THEN** those pure-local avatars remain first-class entries in the same operational catalog
- **AND** the workbench does not split the list into incompatible local-vs-remote runtime classes

### Requirement: The current avatar page SHALL become directory-ready before remote surfaces land
Before `Discover` and `Sources` are implemented, the current avatar page SHALL already use `My Avatars`-compatible structure and language. It SHALL avoid hard-coding a local-only catalog story that would require a conceptual rewrite later.

#### Scenario: Current page stops over-committing to local-only catalog language
- **WHEN** the operator opens the current avatar page before remote-source features are implemented
- **THEN** the dominant page language can already evolve toward `My Avatars` or an equivalent installed-avatar operational framing
- **AND** the page does not require a future rename from a strongly local-only concept just to make the directory IA coherent

#### Scenario: Current page reserves a stable slot for provenance without inventing fake remote UI
- **WHEN** the operator uses the current local-only avatar page
- **THEN** the selected-avatar lens keeps a stable secondary place where source or origin provenance can later appear
- **AND** the page does not introduce fake disabled `Discover` or `Sources` controls before those surfaces actually exist

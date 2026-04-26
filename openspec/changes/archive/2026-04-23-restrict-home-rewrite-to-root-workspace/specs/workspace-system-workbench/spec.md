## ADDED Requirements

### Requirement: Workspace workbench SHALL distinguish `root-workspace` and `public-workspace` semantics
The workspace workbench SHALL make the semantic difference between `root-workspace` and `public-workspace` visible in the page chrome. That distinction SHALL explain env/CLI behavior rather than implying that root-workspace is categorically unshareable. The UI SHALL keep the current workspace root identity explicit while also teaching whether the surface carries root-exclusive env/CLI or collaboration-oriented public-workspace semantics.

#### Scenario: Root-workspace page identifies the fixed root surface
- **WHEN** the operator opens a root-workspace entry in the workbench
- **THEN** the page identifies it as the fixed root-workspace surface
- **AND** the page communicates that root-exclusive env/CLI semantics live there

#### Scenario: Public-workspace page identifies the collaboration surface
- **WHEN** the operator opens an ordinary mounted workspace entry in the workbench
- **THEN** the page identifies it as a public-workspace collaboration surface
- **AND** the page does not imply that root-exclusive env/CLI helpers are available there

#### Scenario: Root-workspace distinction does not claim an ownership ban
- **WHEN** the operator reads the root/public workspace distinction in the workbench
- **THEN** the explanatory copy frames the difference as env/CLI semantics
- **AND** the page does not claim that root-workspace can never be shared or visited

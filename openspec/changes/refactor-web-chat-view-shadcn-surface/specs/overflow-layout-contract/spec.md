## ADDED Requirements

### Requirement: WebUI feature layout shells SHALL derive structure from explicit flex and grid ownership
WebUI feature surfaces SHALL express one-dimensional layout with `flex` and two-dimensional layout with `grid`, and they SHALL size primary scroll regions from that explicit shell structure instead of compensating with patch classes that repair an incorrect container choice.

#### Scenario: Header plus scrolling body uses explicit shell structure
- **WHEN** a route panel needs a fixed header and a scrolling body
- **THEN** the panel declares that relationship through explicit `grid` or `flex` rows
- **THEN** the body `ScrollView` receives the available space without requiring feature-layer compensation classes to cancel unrelated container padding or sizing

#### Scenario: Split view uses explicit two-dimensional structure
- **WHEN** a route needs a room list beside a transcript or a detail pane beside a tool rail
- **THEN** the route declares that split through explicit grid columns or rows
- **THEN** the layout does not rely on stacked patch classes to mimic a missing two-dimensional shell contract

## ADDED Requirements

### Requirement: Compact workbench tabs SHALL preserve the primary running-tab hit target
The shared workbench tab strip SHALL keep the primary tab trigger as the dominant tap target on compact mobile-sized containers. Secondary inline actions such as tab menu or close affordances SHALL NOT cover the running tab label or center hit area when the strip becomes narrow.

#### Scenario: Mobile running tab remains selectable
- **WHEN** the operator opens a workbench with running tabs on an iPhone 14-sized viewport
- **THEN** tapping a visible running tab selects that tab instead of activating an overlaid secondary action
- **THEN** the tab strip keeps its interaction inside shared workbench chrome without requiring a page-specific workaround

#### Scenario: Narrow workbench strips collapse inline tab actions
- **WHEN** the shared tab strip renders inside a narrow container
- **THEN** inline close/menu overlay buttons collapse out of the compact tab chrome
- **THEN** the tab trigger padding contracts back so the visible label keeps the primary hit target

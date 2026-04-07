## MODIFIED Requirements

### Requirement: Message-system tabs SHALL resolve canonical room icon identity
The message-system workbench SHALL render icon-bearing tabs for fixed views and room views. Dynamic room tabs SHALL resolve room-owned icons from the canonical icon authority instead of falling back to label-only initials as the durable navigation model. The workbench chrome SHALL remain renderable while the room catalog is still hydrating, and fixed tabs such as `New room` SHALL NOT blank the page during that initial mount path.

#### Scenario: Room tab shows canonical room icon
- **WHEN** the operator opens or reopens a room tab in Messages
- **THEN** that tab renders the room's canonical icon from the room icon authority
- **THEN** the tab does not rely on a feature-local initials-only fallback as its primary identity surface

#### Scenario: Fixed tabs keep stable non-room icons
- **WHEN** the workbench renders fixed tabs such as `New room`
- **THEN** those tabs still render their stable non-room icon affordances
- **THEN** the presence of room icons does not remove icon affordances from the rest of the workbench

#### Scenario: Initial room hydration keeps the workbench chrome mounted
- **WHEN** the operator opens `/messages`, `/messages/new`, or a room deep link before the first room-catalog response resolves
- **THEN** the route still renders the workbench chrome with its fixed tab affordances instead of a blank page
- **THEN** the initial hydration path does not throw a client runtime error while the room catalog transitions from idle to loading

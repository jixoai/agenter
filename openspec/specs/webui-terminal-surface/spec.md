# webui-terminal-surface Specification

## Purpose
Define how WebUI renders the global terminal workbench and terminal-facing surfaces from the runtime terminal contract.

## Requirements
### Requirement: WebUI terminal and devtools surfaces SHALL consume the runtime terminal contract directly
WebUI terminal-facing surfaces SHALL render from global terminal ids, focused terminal sets, title/status metadata, and explicit terminal representation metadata instead of relying on legacy session-private terminal assumptions.

#### Scenario: Terminals page renders from global terminal ids
- **WHEN** the user opens the top-level `Terminals` page
- **THEN** the page derives its visible terminal selection from the shared global terminal contract
- **THEN** it does not require a session-private terminal route to function

#### Scenario: Terminal-facing views keep activity inspection
- **WHEN** the terminal surface renders terminal activity and latest read output
- **THEN** it uses the existing paging contract plus explicit representation metadata
- **THEN** the route does not fork a second terminal activity model

### Requirement: Terminals page SHALL expose a tabbed terminal workbench
The top-level `Terminals` page SHALL expose the running global terminal catalog as a tabbed workbench with one terminal-local toolbar.

#### Scenario: Running terminals appear as tabs
- **WHEN** more than one terminal is available in the global terminal catalog
- **THEN** the page shows a tab strip for terminal switching
- **THEN** tab labels use the terminal display title and status instead of raw ids only

#### Scenario: Toolbar keeps terminal-local controls
- **WHEN** the user is viewing the `Terminals` page
- **THEN** the terminal-local toolbar exposes controls such as theme or shortcut affordances on the leading side
- **THEN** those controls remain local to the terminal surface instead of leaking into unrelated shell chrome

### Requirement: Terminals page SHALL visualize actor state through AvatarGroup semantics
The `Terminals` page SHALL render attached actors through an AvatarGroup that encodes online/focus state with badge colors and permission state with border colors.

#### Scenario: Badge colors reflect online and focus state
- **WHEN** the page renders attached actors for a terminal
- **THEN** badge colors distinguish offline, online-unfocused, and online-focused states
- **THEN** the legend remains stable across desktop and compact layouts

#### Scenario: Border colors reflect terminal grant state
- **WHEN** the page renders attached actors for a terminal
- **THEN** border colors distinguish `readonly`, `requester`, `writer`, and `admin`
- **THEN** the user can identify write authority without opening a secondary inspector first

### Requirement: Terminals page SHALL warn before allowing multiple writers
When a terminal configuration action would leave more than one actor with `writer` authority, the UI SHALL present a downgrade prompt before applying the change.

#### Scenario: Multiple writers trigger a downgrade prompt
- **WHEN** the user grants `writer` access to an actor while another actor already has `writer`
- **THEN** the UI warns that shared unrestricted writers can conflict
- **THEN** the prompt offers a downgrade path that changes the other writer to `requester` before confirming

## MODIFIED Requirements

### Requirement: Shared chat surfaces SHALL follow Framework7 mobile density

Composer, source-inspection, and comment-detail surfaces SHALL read as the same Framework7/iOS product family as the app-view shell. Framework7 `Page`, `Toolbar`, `Sheet`, `Popup`, and `PageContent` components SHALL retain their official layout responsibilities. Custom Web Chat spacing MAY be applied through Framework7 extension variables such as `--f7-page-content-extra-padding-*` or through inner content shells, but Web Chat SHALL NOT overwrite `.page-content` whole `padding` in a way that disables Framework7 navbar, toolbar, searchbar, or safe-area offset formulas.

#### Scenario: Composer remains a compact messagebar-style surface

- **WHEN** the operator focuses the draft composer
- **THEN** the input, attachments rail, and action buttons keep compact mobile-first proportions
- **AND** the draft field does not read like a detached desktop card

#### Scenario: Comment detail remains quiet and readable

- **WHEN** the operator opens comment detail from a comment resource
- **THEN** the sheet uses compact title, segmented mode control, and quiet content cards
- **AND** long source identifiers do not dominate the primary reading surface
- **AND** edit-mode controls and textarea content remain fully visible inside the mobile safe area

#### Scenario: Comment edit sheets retain official Framework7 chrome

- **GIVEN** a comment edit surface is implemented as a Framework7 `Sheet`
- **WHEN** it needs cancel/save toolbar actions and editable content
- **THEN** the component uses the official direct-child `Sheet -> Toolbar -> PageContent` topology
- **AND** Web Chat does not repaint `.sheet-modal` or `.toolbar` with host-local translucent backgrounds or custom blur chrome
- **AND** custom product spacing is limited to Framework7 variables or inner shells below `PageContent`

#### Scenario: Framework7 Sheet close lifecycle is not bypassed

- **GIVEN** a comment edit surface is implemented as a swipeable Framework7 `Sheet`
- **WHEN** an empty-comment delete or parent modal close makes the edit panel no longer needed
- **THEN** Web Chat first updates the Sheet `opened` prop to `false`
- **AND** Web Chat retains the Sheet component until `onSheetClosed` runs
- **AND** stale Framework7 swipe or backdrop click handlers cannot read a destroyed Sheet instance

#### Scenario: Framework7 PageContent padding ownership is preserved

- **GIVEN** a comment edit surface uses Framework7 `Toolbar` followed by `PageContent`
- **WHEN** custom vertical or safe-area spacing is needed
- **THEN** Web Chat keeps Framework7's `padding-top` and `padding-bottom` formulas active
- **AND** extra spacing is expressed via `--f7-page-content-extra-padding-top`, `--f7-page-content-extra-padding-bottom`, or an inner shell
- **AND** the implementation does not set a whole `padding` declaration on `.page-content` that overrides the Framework7 formulas
- **AND** browser CSS-rule evidence can show which Framework7 rule owns the final offset calculation

#### Scenario: Safe-area overrides are proven before they remain

- **WHEN** Web Chat uses `env(safe-area-inset-*)` on a Framework7-adjacent surface
- **THEN** the implementation has checked whether the same padding or margin side is already owned by Framework7 defaults
- **AND** conflicting overrides are replaced with framework variables or inner-shell spacing
- **AND** any remaining direct `env(...)` usage is justified as non-conflicting inner content layout

### Requirement: Visual review SHALL be route-level evidence for this slice

This slice SHALL treat real route-level screenshots and CSS-rule inspection as the primary acceptance artifact for the visual-law work, including temporary-view states and resource activation states.

#### Scenario: Visual acceptance uses real app-view screenshots and CSS rules

- **WHEN** the operator claims the visual law is aligned
- **THEN** fresh route-level screenshots from the real app-view or Studio-embedded app-view URL exist
- **AND** those screenshots cover sender/avatar presentation, message action geometry, comment anchor/detail, and source-comment edit state
- **AND** source-comment edit state is covered by route-level proof so bottom sheets cannot hide the textarea or clip save actions
- **AND** CSS-rule evidence records the relevant `.page-content` padding rules before and after the fix
- **AND** DOM tests are treated as behavior regression evidence rather than visual proof

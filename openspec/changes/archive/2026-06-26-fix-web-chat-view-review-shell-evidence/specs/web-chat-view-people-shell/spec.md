## MODIFIED Requirements

### Requirement: Example app SHALL expose a three-destination chat shell

The `web-chat-view` example SHALL present message-system as a mobile-first Framework7 app with `Messages`, `Contacts`, and `Me` as primary destinations. Room chat SHALL be a child surface of Messages rather than the whole app. Mobile child surfaces SHALL be complete routed pages and SHALL NOT appear as partially open panels over the root tab surface.

#### Scenario: Mobile shell opens with WeChat-style destinations

- **WHEN** the operator opens the example on an iPhone-class viewport
- **THEN** the bottom tabbar exposes `Messages`, `Contacts`, and `Me`
- **THEN** each destination owns a distinct Framework7 page surface
- **THEN** the room transcript is reached from Messages instead of being the only application screen

#### Scenario: Child pages suspend primary tabbar

- **WHEN** the operator opens room chat, contact detail, source management, or source detail
- **THEN** the primary bottom tabbar is hidden
- **THEN** the child page returns through the Framework7 Navbar back affordance
- **THEN** global navigation returns only after the operator leaves the child surface
- **THEN** the child page does not leave the previous root destination exposed as a half-open or offset background

#### Scenario: Desktop derives from the same destination model

- **WHEN** the operator opens the example on a wide viewport
- **THEN** the app may use split-view or master-detail layout
- **THEN** the visible navigation still maps to `Messages`, `Contacts`, and `Me`
- **THEN** desktop does not introduce a separate admin-dashboard IA for the same facts

#### Scenario: Root destinations stay list-driven and quiet

- **WHEN** the operator opens `Messages`, `Contacts`, or `Me` on mobile
- **THEN** the first viewport is dominated by grouped list content, search, summary rows, and primary navigation affordances
- **THEN** the page does not spend the first viewport on isolated explainer blocks, oversized spacer rhythm, or demo-style shell narration

#### Scenario: Wide split view keeps explicit app/master/detail responsibility

- **WHEN** the operator opens the example on a wide viewport
- **THEN** the left rail remains app-level navigation
- **THEN** the middle rail remains destination-owned master content
- **THEN** the right rail remains detail or room content
- **THEN** the shell does not visually flatten those three responsibilities into one custom white-pane workspace

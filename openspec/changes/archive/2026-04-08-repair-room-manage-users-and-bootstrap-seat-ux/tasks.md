## 1. Projection and Capability Law

- [x] 1.1 Update `message-system-surface` requirements so internal bootstrap control seats are not projected as ordinary room users
- [x] 1.2 Update the room-manage interaction contract so membership and permission mutation have separate destinations
- [x] 1.3 Update the room-manage shell contract so stretchable flex/grid regions explicitly name their `ScrollView` owner

## 2. Message-system Surface

- [x] 2.1 Refactor room seat/send-as/viewer projection so system bootstrap seats stay internal to the control plane
- [x] 2.2 Rebuild the room-manage `Users` flow around `List | Add`, keeping membership add/remove actions there while moving role edits into `Permissions`
- [x] 2.3 Remove room-management stat cards and ensure each stretchable room-manage region uses one `ScrollView`

## 3. Verification

- [x] 3.1 Update relevant Storybook or unit coverage for the room-manage projection and navigation flow
- [x] 3.2 Run targeted typecheck and test commands for the room-manage surface

## 4. Reopened Room-Manage Closure

- [x] 4.1 Repair the room-manage dialog split geometry so the desktop shell renders a real sidebar + stage layout instead of collapsing into one stacked column
- [x] 4.2 Tighten the room-manage stage chrome and section content so close controls, section rails, and `Users/Permissions` flows stay readable on desktop and compact viewports

## 1. OpenSpec And Geometry Contract

- [x] 1.1 Add the terminal-system-surface delta spec for the stabilized terminal-window projection and titlebar law
- [x] 1.2 Update the terminal-window requirement note so titlebar inline-end is limited to size information only

## 2. Terminal Window Surface Implementation

- [x] 2.1 Update terminal projection helpers and terminal-window rendering so `fit` keeps unscaled titlebar chrome and `cover` renders as a frameless sticky-top shell without a resize handle
- [x] 2.2 Replace the titlebar controls with the two macOS-style current-state circles and limit inline-end metadata to size information only
- [x] 2.3 Move terminal deletion out of the titlebar and keep it as a separate destructive route action with the existing confirmation flow

## 3. Verification

- [x] 3.1 Update geometry unit tests for fit/cover projection behavior and live resize invariants
- [x] 3.2 Update Storybook DOM scenarios for titlebar chrome, projection switching, and delete-action behavior
- [x] 3.3 Update targeted E2E coverage for live resize and projection behavior, then run the focused verification commands

## 1. Reproduction / Contract

- [x] 1.1 Add or update a browser-level regression that directly covers `stopped Heartbeat first paint -> Start runtime -> Running`.
- [x] 1.2 Document the Heartbeat runtime toggle contract in the change specs before code changes are declared complete.

## 2. Implementation

- [x] 2.1 Add route-local pending and error state for Heartbeat runtime toggle actions without changing kernel lifecycle law.
- [x] 2.2 Render a visible route-level notice when Heartbeat runtime toggle fails, and clear that notice after a successful retry.

## 3. Verification

- [x] 3.1 Run the targeted WebUI E2E coverage for the new Heartbeat runtime toggle scenario.
- [x] 3.2 Run one real daemon + WebUI walkthrough to confirm stopped Heartbeat first-paint start still succeeds on the current local environment.

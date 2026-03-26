## 1. Diagnosis

- [x] 1.1 Reproduce the Lit `change-in-update` warning in a focused terminal Storybook/browser path and isolate whether it originates in the WebComponent lifecycle or the React host boundary.
- [x] 1.2 Document the concrete trigger path in code comments or test setup so the fix is traceable.

## 2. Fix

- [x] 2.1 Refactor the offending terminal-view lifecycle or host sync logic so terminal mount/hydration no longer schedules an update from inside an update completion path.
- [x] 2.2 Preserve existing terminal behavior for snapshot hydration, transport lifecycle, fixed PTY geometry, and fit/cover presentation.

## 3. Verification

- [x] 3.1 Add or update regression coverage that fails if `terminal-view` emits Lit `change-in-update` warnings during the terminal Storybook/browser render.
- [x] 3.2 Re-run focused terminal-view and WebUI terminal tests to prove the fix is behaviorally neutral aside from removing the warning.

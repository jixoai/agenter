## 1. Spec and Layout Law

- [x] 1.1 Update `message-system-surface` to require a dialog-sidebar management shell with explicit overview/users/access staging
- [x] 1.2 Update `workspace-runtime-shell` to require a primary runtime stage plus a secondary facts rail
- [x] 1.3 Update `scrollview-surface` so dialog management shells and runtime shells explicitly delegate stretchable regions to `ScrollView`

## 2. Message Manage Dialog

- [x] 2.1 Refactor the `Manage room` dialog shell into a responsive rail + detail composition
- [x] 2.2 Rebuild the overview/users/access sections so the detail stage uses semantic surfaces and one scroll owner
- [x] 2.3 Update Storybook coverage or harnesses so the management dialog layout remains regression-safe

## 3. Runtime Shell

- [x] 3.1 Refactor the runtime shell layout so the selected tab has a stronger primary stage and the right rail is visually secondary
- [x] 3.2 Rebuild `Attention` and the peer runtime pages with clearer semantic cards and quieter metadata grouping
- [x] 3.3 Add or extend regression coverage for runtime-shell layout-critical behavior

## 4. Verification

- [x] 4.1 Run targeted typecheck and relevant unit/story/e2e coverage
- [x] 4.2 Re-run desktop and mobile review for `Messages` manage dialog and runtime shell pages

## 1. HelpHint Platform

- [ ] 1.1 Update the `persistent-help-hints` contract so `HelpHint` is closed by default and passive first-visit onboarding is explicit opt-in
- [ ] 1.2 Implement the `HelpHint` atom and Svelte wrapper changes for explicit passive onboarding while keeping pointer, keyboard, and shortcut discoverability intact
- [ ] 1.3 Add BDD unit coverage for the default-closed and opt-in passive-on-first-visit behaviors

## 2. Workspace Avatar Copy Flow

- [ ] 2.1 Update the `workspace-avatar-management` contract so avatar copy submission is a durable form interaction
- [ ] 2.2 Refactor the `Workspaces` copy dialog to use form submit semantics and stable source/target snapshots
- [ ] 2.3 Keep optimistic avatar selection correct across success and rollback

## 3. Verification

- [ ] 3.1 Extend Playwright BDD coverage for the repaired copy-avatar flow and non-intrusive help-hint default behavior
- [ ] 3.2 Run targeted typecheck, unit, E2E, and desktop/mobile dogfood verification for the repaired paths

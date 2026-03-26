## 1. Session-native Devtools routing

- [x] 1.1 Add `/session/$SESSION_ID/devtools` and derive workspace/session chrome from the session record instead of `workspacePath` query coupling.
- [x] 1.2 Replace local-memory Devtools selection state with typed route search state for panel, cycle, context, commit, detail view, and attention query.
- [x] 1.3 Update cross-links into Devtools so attention refs and cycle refs navigate through the new session route.

## 2. Attention inspector information architecture

- [x] 2.1 Rename the top-level `Contexts` panel to `Attention`.
- [x] 2.2 Move `Context / Items` tabs into the right-side detail pane that appears after selecting an attention context.
- [x] 2.3 Bind `Query commits` and score/hash traversal to route state so reload and browser history preserve the same inspection target.

## 3. Verification

- [x] 3.1 Add/update Storybook DOM coverage for route-backed attention detail navigation and right-pane tab placement.
- [x] 3.2 Update WebUI route/unit/e2e coverage for `/session/$SESSION_ID/devtools` deep links and back/forward behavior.

## 1. OpenSpec contracts

- [x] 1.1 Add delta specs for adaptive workspace navigation, chat surface ownership, Devtools detail presentation, Settings detail presentation, and overflow ownership.

## 2. Adaptive scaffold primitives

- [x] 2.1 Add `useAdaptiveViewport()` and migrate shell callers away from the width-only compact decision for workspace navigation behavior.
- [x] 2.2 Refactor `AppRoot` and `WorkspaceShellFrame` so `AppHeader` stays passive-global, workspace routes get a dedicated `WorkspaceHeader`, and `BottomNavBar` only appears on portrait compact/medium layouts.

## 3. Route ownership and scroll models

- [x] 3.1 Remove `SessionToolbar` from `ChatPanel`, move the state-driven session control into workspace route header chrome, and keep Chat as one transcript scroll owner plus fixed composer.
- [x] 3.2 Update Devtools so route tabs stay fixed, active panels own their own scroll, and `CycleInspectorPanel` uses split panes on desktop/landscape plus right-sheet detail on portrait compact layouts.
- [x] 3.3 Update workspace Settings so layers use split panes on desktop/landscape plus right-sheet detail on portrait compact layouts without regressing effective-settings editing.

## 4. Verification

- [x] 4.1 Add or update focused tests for adaptive viewport rules, workspace shell rendering, cycle/settings portrait detail sheets, and chat layout ownership.
- [x] 4.2 Run targeted `@agenter/webui` tests and capture browser walkthrough evidence for desktop and mobile viewport behavior.

## 1. OpenSpec And Durable Contract

- [x] 1.1 Finalize the new change artifacts so the split-detail visibility upgrade and SidebarScaffold replacement are documented before code lands.
- [x] 1.2 Update durable specs and docs (`SPEC.md`, `DESIGN.md`, package specs) to remove active `SplitView` language and codify the new layout split.

## 2. Shared Layout Primitives

- [x] 2.1 Add `SidebarScaffold` to `@agenter/svelte-components`, migrate internal layout tests, and remove `SplitView` exports and source files.
- [x] 2.2 Extend `WorkbenchSplitDetail` with the neutral geometry needed for desktop hidden-detail mode without coupling it to sheet or toolbar semantics.

## 3. Shared WebUI Host

- [x] 3.1 Introduce the shared split-detail visibility host in the WebUI navigation layer and refactor `WorkbenchPageContent` to consume it.
- [x] 3.2 Add host-level regression coverage for desktop close/reopen, compact entry close behavior, and toolbar close takeover.

## 4. Consumer Migration

- [x] 4.1 Migrate stateful `main + right detail` consumers (`terminals`, `workspaces`, `workspace start`, `avatar catalog`, `workspace settings panel`, story harnesses) to the unified visibility law.
- [x] 4.2 Migrate static sidebar consumers (`admin route`, `workspace settings route`, `message room manage dialog`, `ui-studio`, shared stories) to `SidebarScaffold`.
- [x] 4.3 Remove remaining `SplitView` references from app code, shared package demos, tests, and layout contracts.

## 5. Verification

- [x] 5.1 Update or replace brittle source-string tests with contract and Storybook DOM coverage for `SidebarScaffold` and unified split-detail visibility.
- [x] 5.2 Run targeted package tests and WebUI DOM regressions, then perform real browser walkthroughs for the affected desktop and mobile routes.

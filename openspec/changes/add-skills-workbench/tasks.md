## 1. OpenSpec And Durable Contract

- [x] 1.1 Finalize this change's proposal, design, tasks, and delta specs for the new Skills workbench before code lands.
- [x] 1.2 Update durable docs (`SPEC.md`, `DESIGN.md`, and any affected package specs) so `Skills` becomes a first-class shell destination and the new read-only browser surface is documented.

## 2. Backend Read-Only Skill Browser Surface

- [x] 2.1 Add app-server read-only browser contracts for skill catalogs, objective file trees, and bounded file previews across `built-in`, `shared`, `global`, and workspace-grouped avatar skill roots.
- [x] 2.2 Add targeted backend tests that lock root grouping, tree/objectivity, and preview-kind classification, including pdf/media classification and avatar workspace grouping.

## 3. Client Facade

- [x] 3.1 Add typed client-sdk/runtime-store wrappers for the new browser skill queries without creating route-local raw transport calls.
- [x] 3.2 Add client/runtime-store tests that prove the typed facades preserve objective root, tree, and preview payload contracts.

## 4. Skills Workbench UI

- [x] 4.1 Add `Skills` to the primary WebUI shell and implement the fixed catalog tab with `shared/built-in/global/avatars` page-tabs.
- [x] 4.2 Implement the shared accordion list-detail browser for `built-in`, `shared`, and `global`, including FileTreeView selection, shared detail preview, and compact detail drawer behavior.
- [x] 4.3 Implement the `avatars` overview with workspace-grouped avatar-private skill preview and open dedicated avatar skill tabs keyed by avatar nickname.
- [x] 4.4 Upgrade `filePreviewer` into the universal preview shell and route all skill file previews through iframe while using CodeMirror inside `filePreviewer` for text-like files.

## 5. Verification

- [x] 5.1 Add or update unit tests, contract tests, and Storybook DOM coverage for the Skills workbench, avatar tab behavior, and universal file preview routing.
- [x] 5.2 Run targeted package tests, WebUI DOM regressions, and desktop/mobile browser walkthroughs for `/skills`, including one text preview path, one pdf/media preview path, and one dedicated avatar skill tab path through `filePreviewer`.
  - Completed: targeted backend/client/WebUI tests passed, Storybook DOM passed for browser selection + iframe routing contracts, and Playwright route walkthrough passed on both `desktop-chromium` and `mobile-iphone14` for `/skills -> manual.pdf`, `/skills -> SKILL.md` through `filePreviewer`, plus the dedicated `architect` avatar skill tab path.

## 6. Inheritance Order Correction

- [x] 6.1 Reopen the Skills change artifacts and durable specs so the canonical catalog order becomes `shared / built-in / global / avatars`, the default catalog route becomes `shared`, and legacy `view=avatar` canonically redirects to `view=avatars`.
- [x] 6.2 Fix backend skill precedence so runtime-visible skills resolve in the same inheritance order as the UI law: `shared < built-in < global < avatar-private`, while avatar browser groups continue to resolve workspace-scoped private roots objectively.
- [x] 6.3 Update WebUI/client routing, tab state, labels, comments, and tests so the new order and `avatars` page-tab stay aligned across desktop/mobile behavior.
- [x] 6.4 Re-run targeted package tests, Storybook DOM contracts, and desktop/mobile browser walkthroughs after the inheritance-order correction, then create a partial commit for the verified Skills delta.
  - Completed: `runtime-skills` now resolves visible layers in explicit `shared < built-in < global < avatar-private` order, `/skills` defaults to `shared`, legacy `view=avatar` canonically rewrites to `view=avatars`, `Sparkles` now represents `Skills`, targeted Bun/Vitest/Svelte typecheck passed, Storybook DOM passed, and Playwright passed again on both `desktop-chromium` and `mobile-iphone14`.

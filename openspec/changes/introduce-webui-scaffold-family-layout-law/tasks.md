## 1. Platform Law

- [x] 1.1 Add scaffold-family layout primitives for page, dialog, and split shells
- [x] 1.2 Rebuild `PanelShell` on top of the new scaffold primitive without breaking existing consumers
- [x] 1.3 Document the `oxlint + contract spec` enforcement split for WebUI layout law

## 2. High-Risk Surface Migration

- [x] 2.1 Migrate message-system room management and room creation dialogs to scaffold-family primitives
- [x] 2.2 Migrate message-system and runtime route shells to scaffold-family primitives
- [x] 2.3 Migrate superadmin onboarding and terminal-system shells to scaffold-family primitives where the shell law is currently repeated by hand

## 3. Verification

- [x] 3.1 Add primitive-first stories or DOM-contract coverage for the new layout layer
- [x] 3.2 Strengthen source-contract tests for scaffold-family adoption and remaining forbidden layout patches
- [x] 3.3 Add script-level lint scaffolding for layout-boundary rules where `oxlint` can enforce them
- [x] 3.4 Run targeted typecheck and regression tests for messages, runtime, terminals, and onboarding

## 4. Reopened Closure Work

- [x] 4.1 Replace feature-level `native-select` usage on scaffold-family routes with the official `ui/select` primitive
- [x] 4.2 Complete real desktop/mobile walkthrough for scaffold-family routes (`/workspaces`, `/history`, `/messages`, `/terminals`, `/settings`, runtime attention)
- [x] 4.3 Finish compact `terminal-system` closure so the secondary `Actions + Users` surface stays visible and fully interactive on mobile after terminal selection

## 5. Reopened Layout Law Corrections

- [x] 5.1 Move scaffold-family row/column ownership into package-local CSS so `Scaffold` and `SplitView` do not depend on consumer Tailwind generation for responsive behavior
- [x] 5.2 Re-run the full first-level route walkthrough and repair any page that still stacks secondary panes or collapses its primary stretch region after the shared layout-law correction
- [x] 5.3 Remove leftover secondary fact/summary surfaces on `Workspaces`, runtime peer pages, and related first-level shells where they still compete with the primary operator task

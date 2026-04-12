## 1. Workspace workbench shell and shared header

- [x] 1.1 Add the global WorkspaceSystem workbench route/surface in `packages/webui` and align it with the durable `left-sidebar + chrome-window + page-content` scaffold law
- [x] 1.2 Implement the shared workspace content header with `View as` avatar switching, avatar icon/nickname rendering, workspace-path display, and persistence cues
- [x] 1.3 Wire toolbar second-line mode switching for `Explorer`, `Rules`, and `Private`
- [x] 1.4 Implement mode-specific toolbar action sets plus inline page-search affordances instead of one fixed shared button strip
- [x] 1.5 Implement responsive shell ownership changes across breakpoints: persistent sidebar/drawer on tablet landscape where possible, compact nav + stacked detail sheet on portrait tablet/phone
- [x] 1.6 Extract the validated shared shell primitives from the recovered component shelf before route-level page assembly, including `left-sidebar`, `tabs`, workspace/avatar toolbars, shared content header, and typed right drawers
- [x] 1.7 Complete the design component library against the real WebUI/component code, using Storybook or equivalent live rendering screenshots whenever a component's visual truth is unclear from existing design artifacts alone
- Note: `design/webui/components.pen`, `design/webui/workspaces.pen`, and `design/webui/avatars.pen` now stay aligned with live WebUI truth through `workspace-shell.stories.svelte`, `runtime-stage-heartbeat.stories.svelte`, and `runtime-heartbeat-message.stories.svelte`.

## 2. Explorer mode

- [x] 2.1 Implement the single-surface workspace explorer tree with inline permission state on applicable rows
- [x] 2.2 Implement folder disclosure state plus virtualized rendering for large trees
- [x] 2.3 Enforce the first-1000-children rule and `Load more` behavior for oversized directories
- [x] 2.4 Implement the Explorer `bottom-area` as quick-rule editing for the currently selected path
- [x] 2.5 Implement preview/inspector right-drawer behavior for Explorer selections using the shared typed preview contract
- [x] 2.6 Implement toolbar-driven page search for Explorer, including highlight, active-match jumping, and cancel flow

## 3. Rules mode

- [x] 3.1 Implement the full workspace rule catalog surface with KISS-first rows for path, access, enabled state, and reorder priority
- [x] 3.2 Implement selected-rule editing in `bottom-area`, including add, duplicate, delete, and apply flows
- [x] 3.3 Keep the Rules right drawer informational or collapsed instead of building a selected-rule inspector
- [x] 3.4 Implement toolbar-driven page search for Rules, including highlight, active-match jumping, and cancel flow

## 4. Private mode

- [x] 4.1 Implement the avatar-private asset tree using the same disclosure/virtualization primitives as Explorer
- [x] 4.2 Remove permission badges from Private rows while preserving avatar-private scope cues
- [x] 4.3 Replace rule-management bottom actions with private-asset creation and organization actions
- [x] 4.4 Implement drawer preview with the shared typed preview contract and metadata docked at the bottom using light separation instead of stacked metadata cards
- [x] 4.5 Implement toolbar-driven page search for Private, including highlight, active-match jumping, and cancel flow

## 5. Avatar runtime shell alignment

- [x] 5.1 Align the Avatar detail shell with the refined `workspace-runtime-shell` delta spec, exposing `Heartbeat / Attention / Settings` and defaulting to `Heartbeat`
- [x] 5.2 Implement the `Heartbeat` main-area as a long virtualized user/assistant stream backed by the session AI-call ledger
- [x] 5.3 Evaluate and integrate `svelte-ai-elements`-style message primitives without coupling message rendering to virtualization ownership
- Note: `runtime-stage-heartbeat.svelte` keeps `ScrollView` as the virtual owner while `runtime-heartbeat-message.svelte` owns row rendering, and Storybook now exercises both layers through `runtime-stage-heartbeat.stories.svelte` and `runtime-heartbeat-message.stories.svelte`.
- [x] 5.4 Keep notification summaries and quick actions inside `Attention` instead of introducing a separate notification page
- [x] 5.5 Implement the `Attention` main-area as one continuous runtime surface ordered as selected context, focused stack, and queued push inbox
- [x] 5.6 Implement the `Attention` right-drawer with light inspection sections and bottom-docked summary facts instead of stacked metadata cards
- [x] 5.7 Remove `Cycles` and `OpenTelemetry` from the primary Avatar detail path, and link future deep technical inspection to secondary follow-up surfaces instead
- [x] 5.8 Implement the `Settings` tab as a runtime-scoped settings surface with save/reset actions kept in `bottom-area`
- [x] 5.9 Implement responsive Avatar runtime shells across tablet landscape, tablet portrait, and phone using the same compact-nav + stacked-detail adaptation law as Workspace

## 6. Verification

- [x] 6.1 Add Storybook DOM coverage for workspace mode switching, shared content header behavior, and tree interaction disclosure
- Note: `pnpm --filter @agenter/webui test:dom` now passes with the Storybook DOM contracts for workspace mode switching, shared content header behavior, tree disclosure interaction, and the Heartbeat message primitive.
- [x] 6.2 Add browser-level desktop verification for Explorer, Rules, Private, `Heartbeat`, `Attention`, `Settings`, and inline page-search behavior
- [x] 6.3 Add browser-level tablet/mobile verification for the compact shell, shared header, and stacked detail-sheet behavior
- [x] 6.4 Rebuild the route review boards from imported component-library and route-part assets, then verify that the assembled pages do not introduce positional drift or offset mismatches
- Note: `design/webui/workspaces.pen` and `design/webui/avatars.pen` both import shared parts through the `wc` namespace from `design/webui/components.pen`, and the rebuilt desktop/compact boards remain the durable review source for the current WebUI pass.

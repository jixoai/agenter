## Context

The archived backend change `refactor-workspace-system-and-attention-core` already replaced the core law: Avatars are global identities, workspaces are independent mounted resources, and attention owns notification ingress. The WebUI still needs a frontend follow-up that projects those laws into stable operator surfaces instead of continuing to inherit the older workspace-local shell model.

The current design pass has already settled several non-negotiable shell laws:

- the application shell remains `left-sidebar + chrome-window`;
- `chrome-window` remains `tabs + page-toolbar + page-content`;
- `page-content` remains `main-area + bottom-area + right-drawer`;
- `page-content` itself owns the horizontal composition rather than relying on fixed-width hacks;
- one workspace equals one directory root;
- `Explorer`, `Rules`, and `Private` are peer workspace modes;
- `Rules` is not an `Explorer` sub-panel;
- `Private` uses the same file-tree mental model but not the same permission chrome;
- Avatar detail now uses `Heartbeat / Attention / Settings`, defaults to `Heartbeat`, and keeps notification quick actions embedded inside `Attention`.

This change therefore acts as the frontend contract bridge between the new backend truths and the eventual WebUI implementation.

Working artifact:
- Persistent Pencil sources for this change now live under `design/` using a three-layer model:
  - `design/design-system.pen` for atomic, orthogonal, durable design-system components plus a small number of polished demos;
  - `design/webui/components.pen` for cross-route WebUI parts;
  - `design/webui/workspaces.pen` and `design/webui/avatars.pen` for route-local parts plus review boards.
- The active `.pen` now preserves a separate `Recovered Baseline / 2026-04-10 Early Hours` desktop section so the manually validated early-hours draft remains the first visual truth instead of being overwritten by later supplemental work.
- The restored desktop boards now explicitly separate **shell baseline provenance** from **content baseline provenance**:
  - shell baseline comes from the earlier human-validated `chrome-window / tabs / page-toolbar / seam` pass recovered from the 2026-04-09 Codex session;
  - content baseline comes from the 2026-04-10 early-hours workspace/avatar page-body iterations.
- The current four desktop boards (`zrd4R`, `MFdeN`, `4eAmB`, `R0rD2`) now live in the route files and use that restored shell baseline rather than the later “morning style” shell that had drifted toward larger radii, taller toolbars, and weaker chrome hierarchy.
- The three workspace desktop boards now also restore the compact shell details that were still missing after the first recovery pass:
  - tabs use short resource titles instead of `Workspace / ...` prefixed labels;
  - toolbar row 1 uses a short identity (`default`) plus a light subtitle (`workspace view`) rather than a system-explainer heading;
  - toolbar row 2 is reserved for page-level mode pills (`Explorer / Rules / Private`) at inline-start; avatar lens switching stays in the shared content header with `View as`.
- Shared shell primitives are now split according to reuse scope:
  - truly shared shell parts live in `design/webui/components.pen`;
  - workspace-only shell/body parts live in `design/webui/workspaces.pen`;
  - avatar-only shell/body parts live in `design/webui/avatars.pen`.
- Cross-file reuse has been validated in Pencil using `imports + namespaced ref`; route files already render imported shared parts such as `wc:ROgKh` instead of keeping copied sidebar clones.
- After recovering mature desktop states from the prior Codex session, the current review boards now also preserve three concrete interaction exemplars: row-first `Rules`, typed `Private` media preview, and search-active `Explorer`.
- The component library is no longer arranged as a mixed multi-column shelf inside the review file. It now uses a left-aligned row model in `design/webui/components.pen`: one component family per row, with family variants expanding horizontally.
- Current route-board coverage in `design/` now includes:
  - `design/webui/workspaces.pen`: desktop `Explorer / Rules / Private` boards plus compact `Explorer` shell studies for tablet landscape, tablet portrait, and phone;
  - `design/webui/avatars.pen`: desktop `Heartbeat / Attention / Settings` boards plus compact `Heartbeat` shell studies for tablet landscape, tablet portrait, and phone.
- Route-board assembly is now verifiably import-based instead of copy-based:
  - `design/webui/workspaces.pen` declares a `wc` import namespace for shared parts from `design/webui/components.pen`;
  - `design/webui/avatars.pen` declares the same `wc` import namespace, so workspace and avatar boards share one component-library source instead of drifting local clones.
- Live rendering truth for the component shelf now includes Storybook-backed workspace and runtime surfaces:
  - `packages/webui/src/lib/features/workspaces/workspace-shell.stories.svelte` remains the shell/header/tree truth source;
  - `packages/webui/src/lib/features/runtime/runtime-stage-heartbeat.stories.svelte` anchors the Heartbeat stage container and `Load older` affordance against the real WebUI implementation;
  - `packages/webui/src/lib/features/runtime/runtime-heartbeat-message.stories.svelte` anchors the assistant/user ledger message primitive directly, so the component shelf has a live rendering source that does not depend on virtual-scroll measurement.

## Goals / Non-Goals

**Goals:**
- define the durable WebUI contract for the global workspace workbench;
- define how `Explorer`, `Rules`, and `Private` share one workspace shell while keeping distinct responsibilities;
- capture the shared content header contract for `View as` avatar switching plus workspace-path context;
- codify large-tree interaction behavior before implementation, including disclosure, virtualization, and `load more`;
- refine the Avatar detail runtime shell so attention and notification quick actions remain first-class without re-embedding workspace/history panels.

**Non-Goals:**
- changing backend workspace, attention, or notification laws again;
- reintroducing multi-root workspace detail semantics;
- implementing mobile/tablet layouts in this design artifact before the desktop shell laws settle;
- specifying final CSS tokens, final iconography, or pixel-perfect visual polish for every subview.

## Decisions

### Restored desktop shell truth comes from the earlier chrome pass, not from the later content pass

The current desktop review boards intentionally use a shell baseline recovered from an earlier session segment than the one that produced the mature `Explorer / Rules / Private / Attention` page bodies.

That shell baseline is now part of the durable design truth for this change:

- `chrome-window` keeps a clear frame with restrained corner radius;
- the active tab visually connects to `page-toolbar`;
- `page-toolbar` stays fixed at a compact `48px`;
- tabs prefer short resource identity over verbose system-prefixed labels;
- toolbar identity icon belongs to the whole toolbar inline-start, not to row 1;
- toolbar row 1 identity is short and runtime-like, not explanatory;
- workspace toolbar row 2 is mode-first (`Explorer / Rules / Private`) rather than avatar-lens-first;
- `View as` avatar switching belongs to the shared content header, not to workspace toolbar row 2;
- toolbar row 1 right actions use compact borderless icon buttons;
- toolbar and `page-content` are separated by one clean divider only.

Why:
- the user explicitly rejected the later “morning” shell as a drift away from the manually validated chrome structure;
- without separating shell provenance from content provenance, recovery work keeps re-mixing correct page bodies with incorrect chrome styling;
- the shell laws are durable and reusable across Workspace and Avatar pages, while the page-body semantics can keep evolving independently.

### Pencil assets now follow a route-layered component model instead of one mixed review file

The active design source of truth is no longer a single change-local `mockups.pen/components.pen` pair. It now uses a three-layer structure under `design/`:

- `design/design-system.pen` for atomic design-system components and polished demos;
- `design/webui/components.pen` for cross-route WebUI parts;
- `design/webui/workspaces.pen` and `design/webui/avatars.pen` for route-local components plus review boards.

Why:
- the user explicitly asked for route-driven splitting rather than a business-mixed `webui.pen`;
- page parts such as workspace toolbars and avatar drawers are not generic enough to belong in the atomic design system;
- stable shell reuse must be real reuse via imports, not a copied baseline that drifts independently.

Rejected alternative:
- keep all review boards and reusable parts inside `openspec/changes/refine-workspace-attention-webui/*.pen`. That made the long-lived design source of truth too tightly coupled to one temporary change folder and encouraged mixed component/page duplication.

### Final frontend acceptance is component-library-first, with code-backed visual truth

This change is not considered visually complete just because a page-level review board looks approximately correct. Final acceptance requires two additional conditions:

- the component library must be filled out against the actual WebUI/component codebase rather than only inferred from page mockups;
- route boards and route-local parts must then be rebuilt from imported component/design-part sources and verified to assemble without positional drift.

When a component cannot be reconstructed confidently from existing design context alone, the implementation-side visual truth should come from the codebase itself, preferably by exporting or capturing the component through Storybook or another equivalent live rendering path.

Why:
- the user explicitly wants the component shelf to become a durable reusable asset rather than a partial afterthought;
- visual fidelity should be anchored to the real component implementation when design memory is ambiguous;
- the route boards must prove that componentization is real by reassembling the page from imports without silent offset drift.

Rejected alternative:
- treat the current recovered boards as sufficient final output and postpone component completion until implementation. That would preserve too much page-level duplication and would not prove that the design library is coherent enough to drive the real route assemblies.

### Workspace workbench is a persistent system surface, not a session-local workspace shell

The workspace page is redefined as a global system workbench comparable to Messages and Terminals. The `Workspaces` destination itself is a fixed start page where the operator chooses one root, then the chosen root opens in its own closable workbench tab so the detail route identifies one workspace resource and one directory root and projects that resource through the currently selected avatar lens.

Why:
- the backend now treats workspaces as independent mounted resources;
- the user explicitly clarified that one workspace maps to one directory, while one avatar can control multiple workspaces;
- the old “workspace page as a runtime/session wrapper” model would continue to leak the wrong law into the UI;
- letting the detail page hot-swap its root from an inline selector keeps pretending that the operator is still inside one mutable shell instead of one chosen resource;
- the user explicitly asked for the chosen workspace to open as a new tab, so route/tab ownership now follows the same browser-like mental model already used by Messages.

Rejected alternative:
- keep the old session-local workspace shell and only rename labels. That would preserve the wrong conceptual model and would make permissions, private assets, and persistence harder to explain.

### Avatars workbench keeps one fixed catalog tab while runtime and creation flows stay addable

The `Avatars` destination now follows the same chrome-window law as other primary systems, but with one durable fixed tab: `Catalog`. The catalog remains the stable management/start surface for global avatar identities. Running sessions open as dynamic runtime tabs, and `New avatar` opens dedicated draft tabs that can coexist in parallel without replacing the fixed catalog.

For the current frontend pass, `New avatar` is intentionally implemented as a draft-first shell. The route persists draft-local nickname/source state and browser-style tab presence, but the primary create action stays blocked until the backend exposes a durable global-avatar creation contract. The frontend must not fake a successful global-avatar create before that API law exists.

Why:
- the user explicitly asked for `Avatars` to behave like a chrome-window system with one fixed management page plus addable special tabs;
- keeping `Catalog` fixed makes global avatar identity management scanable and prevents the creation flow from hijacking the only stable landing surface;
- draft tabs let operators stage multiple candidate avatars in parallel, which matches the browser-like workbench mental model already used elsewhere.

Rejected alternative:
- keep avatar creation inline inside the catalog body or reuse the old workspace/history subpages. That would collapse catalog management, runtime access, and creation into one mutable page and would reintroduce the wrong workspace-local avatar model.

### `Explorer`, `Rules`, and `Private` are peer modes under one shared content header

The workspace workbench uses toolbar second-line mode switching for `Explorer`, `Rules`, and `Private`. All three modes reuse one shared content header that shows `View as` plus the full workspace root path.

Why:
- these modes change the whole meaning of the page body, so they belong in page-level mode switching rather than in `bottom-area`;
- the operator needs the same avatar lens and path context regardless of mode;
- repeated mode-local headers would waste space and drift semantically.

Rejected alternative:
- keep `Rules` in `Explorer` bottom-area and treat `Private` as a local toggle. This made `Explorer` too heavy and collapsed full rule management into a space better suited for quick actions.

### Explorer stays single-surface and delegates detail to the shared right drawer

`Explorer` no longer uses a nested master-detail split inside `main-area`. The main surface is one tree-first workspace browser. The `right-drawer` owns preview/inspection, and the `bottom-area` owns quick edits for the selected path.

Why:
- once the global scaffold already provides a `right-drawer`, a second internal detail pane inside `main-area` becomes redundant;
- the user explicitly rejected the earlier dual-pane explorer as unnecessary for the single-root model;
- the simpler tree-first layout scales better into compact breakpoints later.

Rejected alternative:
- keep a two-pane explorer inside `main-area`. This duplicated drawer responsibilities and visually overfit a multi-root model that no longer exists.

### Rules mode is the full catalog; Explorer bottom-area is only quick-rule editing

The bottom area under `Explorer` is intentionally narrowed to quick edits for the selected path. Full rule browsing, add/remove, and broader edits move into `Rules`.

Why:
- the user explicitly observed that `Explorer` bottom-space works better for one selected rule than for the whole rule system;
- splitting quick edit from full catalog keeps `Explorer` legible;
- `Rules` can now grow into search, bulk edit, delete, and reorder flows without turning the explorer page into a hybrid dashboard.

### Rules mode stays KISS-first: path, access, enable, reorder

The `Rules` catalog is intentionally reduced to the minimum durable model for this refactor pass: path matcher, access, enabled state, and ordering priority. It does not introduce `kind`, `source`, inheritance, or other secondary taxonomies in the first shipping surface.

The desktop review surface expresses those four facts directly in the row model itself: drag handle for ordering, path as the dominant readable field, compact access pill, and a visible enable toggle. Rule editing remains bottom-docked instead of moving back into the drawer.

Why:
- the user explicitly rejected `kind / source` as premature complexity for the current change;
- wildcard path syntax already carries most of the rule-scope meaning without extra columns;
- keeping the row model small makes desktop, tablet, and phone adaptations substantially easier.

Rejected alternative:
- show a denser rule table with `kind`, `source`, inheritance provenance, and deeper metadata in the primary list. That would violate KISS and would consume space better spent on path readability and inline controls.

### Explorer and Private share the same typed preview law

`Explorer` and `Private` now share one right-drawer preview law: preview remains dominant, metadata stays bottom-docked behind a light divider, and the preview surface itself changes by file type. Text defaults to a CodeMirror-like reading surface; image/audio/video use lightweight media preview; unsupported files explicitly enter a `No preview` state.

The current desktop artifact intentionally demonstrates different concrete preview states across pages so the law is visible in review, not only in prose: `Explorer` and `Explorer Search` show the text-reading state, while `Private` shows the media-preview state.

Why:
- the user explicitly asked for the two drawers to converge rather than evolve independently;
- a typed preview law is more reusable than separate per-page preview styling;
- keeping metadata bottom-docked preserves preview as the primary reading surface.

### Workspace toolbar actions are mode-specific and search is page-native

Toolbar actions are no longer treated as a fixed shared button strip. `Explorer` and `Private` keep search plus preview/inspector affordances, while `Rules` drops preview actions and keeps only rule-relevant toolbar controls. Page search expands from the toolbar icon into a compact find control with query, count, previous, next, and cancel actions.

The desktop search-active board intentionally renders this as an inline page-find control in the toolbar chrome rather than as a detached search panel, so the operator still reads it as page search, not as mode switch or global filtering.

Why:
- the user explicitly rejected a one-size-fits-all toolbar action set;
- mode-specific actions keep toolbar cognition aligned with the currently visible surface;
- the compact inline find control matches the browser-native page-search mental model better than a detached overlay or full-panel filter UI.

### Rules keeps the right drawer informational only

`Rules` no longer uses the `right-drawer` as a rule inspector. The drawer remains available as a light informational zone or collapsible spare surface, while selected-rule editing stays concentrated in the list and the bottom editor.

Why:
- the user explicitly said `Rules` does not need inspector support;
- using the drawer for detailed selection inspection would recreate the very density problems the refactor is trying to remove;
- concentrating edits in one bottom editor produces a clearer desktop mental model and scales down better later.

### Compact breakpoints preserve the same workspace contract while changing surface ownership

The compact workspace designs are now settled enough to define their durable adaptation law:

- `tablet landscape` keeps the visible `left-sidebar`, `chrome-window`, and persistent right-side detail surface for longer;
- `tablet portrait` and `phone` collapse the left navigation into a compact shell/header trigger;
- `tablet portrait` and `phone` translate the desktop `right-drawer` into a stacked sheet at the end of `page-content`, below the `bottom-area`, instead of trying to force a persistent narrow side column.
- when mode labels become too wide for compact toolbars, the UI may abbreviate labels as long as the capability path remains directly reachable.

Why:
- the user asked for four screen classes to be designed against the same overall information architecture;
- preserving the same capability path is more important than preserving desktop geometry one-to-one;
- compact layouts remain understandable because the same shared header, mode switcher, main area, bottom area, and detail surface are all still present.

### Private mode reuses the file-tree mental model but strips permission chrome

`Private` keeps the file/folder listing model so the operator does not have to learn a second navigation pattern. It removes permission badges because the active avatar lens already implies private ownership semantics for that surface.

Why:
- the user explicitly defined `Private` as still being a folder/file list;
- removing permission chrome keeps the difference between shared workspace authority and avatar-private assets visually obvious;
- the same tree interaction law means disclosure, virtualization, and `load more` can be shared implementation primitives.

### Large trees must expose their interaction law in both design and implementation

The workspace tree contract is explicit: folders toggle expanded/collapsed state, large directories are virtualized, only the first 1000 children render initially, and additional children arrive behind a `Load more` row.

Why:
- this behavior is too important to leave as an implementation detail;
- the user explicitly asked for it to be annotated in the design pass;
- without an explicit law, implementation will drift into full eager rendering or hidden truncation.

### Avatar Attention uses one continuous runtime surface instead of split dashboards

The `Attention` tab is refined as one continuous main surface ordered from current `AttentionContext`, to the focused context stack, to queued notification pushes. The queue remains subordinate to the selected context instead of becoming its own peer pane or standalone notification page.

Why:
- the user explicitly wants Avatar detail to stay centered on `AttentionContext`;
- notification capability is now native to attention rather than a separate system surface;
- a continuous single-surface layout keeps the runtime body aligned with the settled `main-area + bottom-area + right-drawer` law.

Rejected alternative:
- splitting `Attention` into multiple internal dashboards or promoting notifications into another primary pane. That would reintroduce page-body fragmentation after the shell law was already clarified.

### Avatar inspectors use light sectional drawers with bottom-docked facts

The Avatar `right-drawer` now uses simple section headings and dividers for runtime facts such as selected attention context, delivery contract, suggested response, and linked runtime sources. Low-priority summary facts stay docked at the bottom instead of being rendered as another card stack.

Why:
- dense runtime inspectors degrade quickly when every section becomes a bordered card;
- the user repeatedly asked to reduce unnecessary borders and card wrappers;
- docking summary facts at the bottom preserves scan order: actionable inspection first, passive metadata last.

### Avatar runtime tabs now have distinct page-body responsibilities

The runtime tabs are no longer just labels in a toolbar; they now own different page-body semantics:

- `Heartbeat` becomes the default landing surface and renders the AI-call ledger as one long user/assistant runtime stream;
- `Attention` stays focused on unresolved obligations, selected `AttentionContext`, and queued pushes instead of becoming a mixed history/devtools dashboard;
- `Settings` becomes the runtime-scoped configuration surface for the current avatar, with save/reset actions and metadata kept out of workspace rules.

The current design direction assumes an AI-message component mental model for `Heartbeat` and explicitly keeps virtualization ownership separate from message rendering so the eventual implementation can adopt `svelte-ai-elements` or compatible primitives without hard-coupling the list controller to one UI library.

Why:
- the backend durable truth is moving to `message_parts + ai_call`, so Avatar detail should read that heartbeat directly instead of projecting old `Cycles` and `OpenTelemetry` tabs;
- the user explicitly asked to keep `Attention` and `Settings` but simplify the runtime shell around a more life-like message stream;
- giving each tab a clear body contract makes later implementation and DOM testing much easier.

### Avatar compact layouts follow the same shell adaptation law as Workspace

Avatar runtime pages now follow the same responsive law as the workspace workbench:

- `tablet landscape` keeps the visible left sidebar and persistent right drawer longer;
- `tablet portrait` and `phone` collapse navigation into a compact shell;
- `tablet portrait` and `phone` translate the desktop `right-drawer` into a stacked sheet below the `bottom-area`.

Why:
- the user asked for the four target screen classes to be supported consistently;
- avatar runtime pages use the same chrome/page-content physics as other system pages;
- preserving the same tab path and same main/bottom/detail responsibilities matters more than preserving the exact desktop geometry.

## Risks / Trade-offs

- [Workspace and Avatar follow-up can drift apart again] → Mitigation: keep both under one active frontend change and continue syncing Pencil output into OpenSpec after each significant design round.
- [Tree virtualization and `load more` may be under-specified for implementation] → Mitigation: keep the behavior normative in the workspace-system-workbench spec and cover it with DOM/E2E tests once implementation starts.
- [Mode-specific toolbar actions may drift back into a fixed shared strip during implementation] → Mitigation: capture the action contract explicitly in the workspace-system-workbench spec and verify it with DOM coverage.
- [Operators may read `Private` as “another workspace root” if visuals are too similar] → Mitigation: keep the shared header but explicitly label avatar-private scope and remove permission badges from the private tree.
- [Avatar tabs may regress into interchangeable shells during implementation] → Mitigation: keep each tab’s main-area / bottom-area / drawer contract explicit in `workspace-runtime-shell/spec.md` and verify them independently.
- [`Heartbeat` may accidentally hard-couple one specific UI library to list virtualization] → Mitigation: keep the design contract at the “AI-message component mental model + separate list ownership” level and defer concrete component binding to implementation.

## Migration Plan

1. Land this frontend follow-up change as the durable contract for workspace and avatar workbench behavior.
2. Implement the shared scaffold primitives and workspace mode routing in `packages/webui`.
3. Implement the shared content header, explorer tree behavior, rule catalog/editor, and private asset browsing against the new backend contracts.
4. Align Avatar detail pages with the refined runtime-shell delta spec.
5. Add Storybook DOM and browser-level verification for desktop first, then extend to tablet/mobile once the shell is stable.

## Open Questions

- The exact avatar-switcher affordance in compact layouts is not finalized yet; only the durable requirement that it exists in the shared content header is settled.
- The desktop toolbar search interaction is now settled. Compact layouts still need final implementation judgment on whether the expanded find control opens inline, as a toolbar takeover, or as a small anchored popover.
- Avatar compact search and action affordances still need final implementation judgment, but the tab responsibilities and shell ownership rules are now stable enough for implementation planning.

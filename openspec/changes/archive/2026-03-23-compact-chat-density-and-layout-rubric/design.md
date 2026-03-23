## Context

The current `TopHeader` still carries app identity, location, connection text, AI text, workspace path, tabs, and route-local `SessionToolbar` actions in one compound surface. In parallel, `ChatPanel` + `AIInput` + `AIInputEditor` still stack multiple rounded shells, borders, padding blocks, and a tall editor minimum height, which makes the first viewport feel wasteful on compact screens. The project also lacks a stable review contract for future layout work, so regressions are only caught after a human screenshot review.

## Goals / Non-Goals

**Goals:**
- Express the Chat composer as two semantic rows with predictable degradation rules.
- Make the top header passive and compact by default.
- Restore route-local ownership for session actions through a single status pill menu.
- Reduce compact-screen padding and height waste without breaking existing transcript/editor behavior.
- Add a durable prompt/rubric + evidence flow for WebUI layout reviews.

**Non-Goals:**
- Replace CodeMirror or the Chat transcript renderer.
- Redesign sidebar/drawer navigation structure.
- Change backend runtime/session protocols.
- Introduce a new markdown/rendering stack.

## Decisions

### 1. Composer becomes `action bar + status bar`
The current toolbar will be split into a larger `ComposerActionBar` and a thinner `ComposerStatusBar`.

- `ComposerActionBar` owns picker/screenshot/send actions only.
- `ComposerStatusBar` owns composer-local status chips and help disclosure.
- The action bar is always one line; send always keeps a visible label.
- Secondary actions (`Attach`, `Screenshot`) use shared-width containers so `ResizeObserver` can reliably decide when to collapse labels.
- Help collapses into a `?` popover before action labels collapse.

Why: this matches the intended visual hierarchy and removes the current mixed-action/mixed-help row.

Alternative considered: keep one toolbar row and only tweak wrapping thresholds. Rejected because it preserves the same semantic mixing and keeps compact layouts fragile.

### 2. The top header stays passive; route-local status returns to the route body
`TopHeader` will stop accepting route-local action slots such as `SessionToolbar`. It will only show:
- app identity
- location label
- passive connection / AI signals
- workspace basename
- workspace tabs

The session surface becomes a route-local `SessionStatusPillMenu` rendered in the page body near the top of Chat/Devtools/Settings.

Why: this keeps the header as passive chrome and gives each route its own first-screen control density.

Alternative considered: compress `SessionToolbar` inside header actions. Rejected because it still mixes passive chrome with route-local controls and costs too much vertical/mental space on compact viewports.

### 3. Passive states prefer icon signals plus tooltip over repeated text
Connection state, AI state, and long workspace path move to compact signals:
- workspace path: basename only in header, full path via tooltip/title
- passive runtime state: icon signal with tooltip-backed text
- header text is limited to facts needed for navigation and orientation

Why: repeated short labels (`Connected`, `AI ready`, full path) consume scarce width without adding new decisions for the user.

Alternative considered: keep short text labels and only reduce padding. Rejected because the redundancy problem remains even with tighter spacing.

### 4. Compact density is enforced through budgeted surfaces, not ad hoc spacing tweaks
We will set explicit compact budgets for:
- route viewport padding
- header row padding
- composer editor min height
- composer status bar height

The shell/layout contract remains: one layer owns spacing, one layer owns background, one layer owns scrolling.

Why: the current problem comes from multiple individually reasonable paddings adding up across shell, route, and composer.

### 5. Layout reviews use a prompt/rubric plus objective evidence
A new document will define:
- generation prompt for AI/engineers
- review prompt for humans/AI
- scorecard dimensions and weights
- required evidence: screenshots + DOM geometry metrics

Storybook/browser tests will output the measurable evidence, while the final score can still be produced by a human or another model.

Why: purely manual review is too late, while purely automated review is too weak for visual hierarchy decisions.

### 6. Storybook verification is component-first, then route assembly
Chat/Shell layout work will be validated in three layers:
- primitive stories for leaf layout contracts (`AdaptiveIconButton`, `StatusSignal`, `SessionStatusPillMenu`, `ComposerActionBar`, `ComposerStatusBar`)
- composite stories for assembled controls (`AIInputToolbar`, `TopHeader`, `WorkspaceShellFrame`, `ChatPanel`)
- route assembly stories that verify the final first viewport on desktop and iPhone SE widths

Page wiring changes must not be used as the first place where a layout regression is discovered. A missing primitive story is treated as a missing contract, not as a test debt item to backfill later.

Why: the current page-level stories catch regressions too late and make it hard to localize which layout contract actually broke.

## Risks / Trade-offs

- [Risk] Header icon signals may become too opaque without enough tooltip coverage. → Mitigation: every passive signal keeps a tooltip/title and accessible label.
- [Risk] Lower composer height could make multi-line drafting feel cramped. → Mitigation: keep line wrapping and allow the editor to grow with content after the tighter minimum height.
- [Risk] Moving session controls into route-local status surfaces may require multiple route integrations. → Mitigation: introduce one shared `SessionStatusPillMenu` primitive reused across Chat/Devtools/Settings.
- [Risk] Geometry-based Storybook assertions can become brittle if they encode arbitrary pixel values. → Mitigation: assert contracts (single row, no overlap, relative height budgets, collapsed/expanded visibility) instead of one exact size.

## Migration Plan

1. Add the OpenSpec delta and the review/rubric document.
2. Refactor `TopHeader` / `WorkspaceShellFrame` to remove route-local header actions.
3. Introduce the route-local `SessionStatusPillMenu` and wire Chat first; reuse it for Devtools/Settings where needed.
4. Split the composer toolbar, reduce editor/shell density, and update stories.
5. Add primitive-first Storybook DOM audits, then add route assembly stories for desktop + iPhone SE.
6. Run targeted WebUI test/build regressions and mark the change tasks complete.

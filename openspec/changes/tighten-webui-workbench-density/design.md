## Context

The repository already has the correct structural law for these pages: shared workbench chrome, a fixed `page-toolbar`, and a reusable split-detail primitive that owns ratio persistence, compact collapse, and close-only toolbar takeover. The current problem is no longer a missing platform primitive; it is route assembly drift.

`Workspaces` currently spends too much vertical and horizontal budget on low-value framing in both its start page and detail route. The shared content header reads like a detached card instead of integrated workbench chrome, the chooser/detail start page gives too much area to low-signal summary content, and the compact route still burns too much space before the main tree or rule catalog gets useful height. `Messages` has a related but narrower problem: its fixed-height toolbar already owns the right semantics, but the compact layout contract is brittle at the `390px` mobile baseline.

After the first pass, a second route-level issue remains: some content surfaces still carry unnecessary `rounded` / `border` framing that no longer communicates distinct semantics. The result is "fake card" layering inside `page-content`, especially in the workspace content header, workspace detail drawer states, and compact room content chrome.

## Goals / Non-Goals

**Goals:**

- Keep the existing split-detail and workbench chrome laws unchanged while tightening high-value route assembly.
- Make `Workspaces` the reference implementation for integrated desktop/mobile density inside the current shell.
- Rebalance the workspace start page toward list-first scanning and factual, low-noise detail summary.
- Rebalance the workspace detail route so the shared content header, primary stage, bottom-area, and right detail use less slack without losing their current role boundaries.
- Make the compact `Messages` room toolbar stable at the fixed `48px` height and `390px` width baseline.
- Remove non-semantic card framing from content areas whose job is density and continuity rather than standalone surface ownership.
- Encode the new behavior in Storybook DOM / contract coverage so future tweaks do not drift.

**Non-Goals:**

- Do not introduce a new layout primitive or re-open the split-detail law.
- Do not redesign `runtime` or `terminals` in this change.
- Do not move detail-local workspace actions into the toolbar.
- Do not invent a second mobile-only room toolbar or workspace shell.

## Decisions

### Tighten route density inside the existing workbench law

The correct architectural move is to keep all workbench framing responsibilities where they already belong:

- `tabs + page-toolbar + page-content` stay shared
- split vs right-sheet stays shared
- workspace and room surfaces only rebalance their local content density

This avoids reopening a solved platform problem just because a few route-local surfaces still look loose.

Alternative considered:

- Rework shared workbench primitives again before touching the routes.
  - Rejected because the current bug is not the primitive contract; it is how the route spends its density budget inside that contract.

### Make the workspace start page list-first, with factual secondary detail

The start page is a chooser, not a showcase card. Its primary job is to help the operator scan roots and enter one quickly. The list therefore keeps height priority, while the right detail only keeps short factual summary plus the explicit open action.

Alternative considered:

- Keep the current large preview/detail treatment and only tighten padding.
  - Rejected because the page would still spend too much space on low-value summary copy and leave too little first-screen scanning budget on mobile.

### Keep one shared workspace content header, but collapse its framing

`View as` and workspace root identity remain shared across `Explorer / Rules / Private`, but the surface needs to read as integrated workbench content instead of a second large hero card. The implementation will keep the same facts while reducing padding, visual weight, and unused white space, especially on compact screens.

Alternative considered:

- Split desktop and mobile into different header structures.
  - Rejected because it would drift the same context facts into two route-local header models and reintroduce maintenance divergence.

### Strip fake-card framing from content areas that already live inside workbench surfaces

When a section already sits inside `page-content`, repeated rounded corners, full borders, and showcase gradients should not survive unless they mark a true semantic owner such as media clipping or destructive notice. The workspace content header, rule rows, preview placeholders, and compact room content chrome should read as integrated content bands, not nested cards.

Alternative considered:

- Keep the current framing and only reduce padding.
  - Rejected because the remaining problem is not only density; it is repeated surface ownership signals that make the content look heavier than it is.

### Treat compact workspace support surfaces as dense docks, not secondary cards

On compact screens, the main tree/catalog must stay dominant. The bottom-area therefore compresses into a denser dock and the right detail keeps only the current preview/metadata model instead of expanding into layered secondary cards.

Alternative considered:

- Leave compact bottom-area and preview surfaces as card-like blocks and only hide some copy.
  - Rejected because the height problem comes from structural slack, not just from text length.

### Fix the room toolbar contract inside the existing 48px band

The room toolbar already has the right semantics and action order. The fix is to tighten layout and affordance sizing so viewer identity, action icons, and `chat/assets` chips all remain visible inside the fixed toolbar band at the `390px` baseline. This is a local composition fix, not a new toolbar model.

Alternative considered:

- Add a separate mobile-only room toolbar or hide mode chips behind another action.
  - Rejected because it would weaken discoverability and violate the current shared toolbar contract.

### Keep the room composer subordinate to the transcript instead of becoming a second footer card

The transcript is the primary room task. The composer therefore needs to stay visually integrated with the footer band, not expand into another stacked surface with its own oversized button row, pill-heavy status rail, and detached draft card. The correct move is to keep the shared composer primitive, but tighten its input shell, keep `Send` inline with `Attach` and `Screenshot` at the `390px` baseline, and demote passive shortcut/help metadata into low-noise text or compact-only hiding.

Alternative considered:

- Keep the current composer stack and only shave a few pixels off padding.
  - Rejected because the main regression is structural: the current send-row takeover and passive pill chrome consume transcript height even when the operator is idle.

### Continue transcript-first tightening in small rounds instead of one large re-theme

After the composer compaction pass, the remaining issue is not a missing primitive. The room surface still spends too much density budget in the transcript lane itself: row padding is loose, bubbles still look slightly over-framed, footer gradients are thicker than their semantic value, and desktop width leaves too much dead center space for the current message mix. The right move is to continue with small evidence-driven reductions so each density change stays reviewable and revertable.

Alternative considered:

- Re-theme the entire message room in one large sweep.
  - Rejected because it would mix too many subjective visual decisions at once and make it harder to preserve the already-fixed compact toolbar and composer contracts.

### Use Storybook contracts as the primary regression gate

Both problem areas are visible and interaction-sensitive. Story-driven DOM tests remain the fastest durable contract:

- workspace shell density and compact behavior
- compact room toolbar visibility at `390px`
- compact room composer density at `390px`

Alternative considered:

- Rely only on source-string contract tests or manual screenshots.
  - Rejected because layout regressions need a real DOM gate, not only string presence checks.

## Risks / Trade-offs

- [Risk] Over-tightening could make the workspace header or bottom-area feel cramped. -> Mitigation: keep full facts visible, reduce framing first, and verify with Storybook screenshots plus DOM tests.
- [Risk] Workspace mobile tightening could accidentally hide key actions when compact detail opens. -> Mitigation: preserve the existing close-only takeover law and keep bottom-area actions available before and after detail open.
- [Risk] The room toolbar compact fix may depend on brittle pixel tolerances. -> Mitigation: update the story assertion to verify containment and visibility against the fixed toolbar band after the new layout settles.
- [Risk] Route-level tuning may expose a later need for a shared density primitive. -> Mitigation: keep implementations local in this change, then promote a primitive only if the same pattern repeats in `runtime` or other workbenches.
- [Risk] Removing too much framing could blur truly separate states such as empty/error/destructive content. -> Mitigation: keep borders only for semantic notice states and preserve clipping only for media/content surfaces that actually need it.

## Migration Plan

1. Update the change-local delta specs for `workspace-system-workbench` and `message-system-surface`.
2. Tighten `Workspaces` start route, detail route, and shared content header.
3. Update workspace stories/contracts so the new density model becomes the regression reference.
4. Tighten the room toolbar compact layout and update its story contract.
5. Run targeted WebUI verification (`typecheck`, Storybook DOM coverage, and visual evidence screenshots).
6. If a regression appears, roll back the route-local density changes without touching the shared split-detail primitive.

## Open Questions

- Whether the same density tightening should next be promoted into a shared compact-toolbar primitive after `runtime` is evaluated.
- Whether `terminals` should later adopt the same “support surface budget” review once the higher-risk `workspaces` and `messages` routes are stable.

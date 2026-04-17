## Context

The repository already has the correct structural law for these pages: shared workbench chrome, a fixed `page-toolbar`, and a reusable split-detail primitive that owns ratio persistence, compact collapse, and close-only toolbar takeover. The current problem is no longer a missing platform primitive; it is route assembly drift.

`Workspaces` currently spends too much vertical and horizontal budget on low-value framing in both its start page and detail route. The shared content header reads like a detached card instead of integrated workbench chrome, the chooser/detail start page gives too much area to low-signal summary content, and the compact route still burns too much space before the main tree or rule catalog gets useful height. `Messages` has a related but narrower problem: its fixed-height toolbar already owns the right semantics, but the compact layout contract is brittle at the `390px` mobile baseline.

Two adjacent workbench routes now show the same density drift. `Avatars / Catalog` still presents its fixed catalog plus runtime lens as two oversized cards, with long runtime ids and action rows competing against the actual identity hierarchy, especially on compact screens. `Terminals / New` has the opposite failure mode: it renders one small create form in the middle of a very large blank canvas, so the fixed tab feels like a sparse staging screen rather than a compact single-task workflow.

After the first pass, a second route-level issue remains: some content surfaces still carry unnecessary `rounded` / `border` framing that no longer communicates distinct semantics. The result is "fake card" layering inside `page-content`, especially in the workspace content header, workspace detail drawer states, and compact room content chrome.

After the second pass, the residual debt narrowed to one last route-assembly follow-up. The final pass removes the fixed-height avatar rail silhouette and the create-terminal inner-card silhouette without changing any shared workbench primitive. `Avatars / Catalog` now keeps a bounded rail only when content needs it, and `Terminals / New` now reads as one integrated task flow plus a low-noise defaults strip inside the existing `page-content` surface.

One avatar-specific debt still remains: the page has too many small rounded/bordered sub-surfaces fighting for attention at once. The toolbar stats render as outline pills, each catalog row still behaves like a tiny card, the runtime hero keeps multiple pill signals, and the support surfaces stack enough border/radius treatment that the page starts feeling ornamental again even after the larger de-framing passes. The next pass should therefore be a stricter "Avatar chrome de-framing" loop: keep true button affordances and semantic notices, but aggressively demote every non-essential pill/card/border on this page.

After that pass, the remaining issue changes shape again: the page is now visually calmer, but an operator who uses it every day still sees too many repeated facts. Counts in the toolbar, repeated running-state chrome, multiple `HelpHint` triggers, always-open long paths, and secondary actions that duplicate top-level navigation all become muscle-memory noise rather than help. The next step is therefore a familiar-user noise-removal pass: keep the page legible for first-time users, but stop defaulting low-frequency detail into the first viewport.

After the familiar-user pass, one last quality gap remains when judged as an enterprise product surface rather than just a de-framed route. The page still keeps a second title band below the workbench toolbar, the desktop content stretches too far for how little structured information it actually contains, and the catalog rows still feel like soft highlighted blocks instead of disciplined operational list items. The next pass should therefore tighten structure, not just decoration: remove repeated top chrome, give the page an intentional content measure on desktop, and turn the catalog into a clearer scan-first list.

## Goals / Non-Goals

**Goals:**

- Keep the existing split-detail and workbench chrome laws unchanged while tightening high-value route assembly.
- Make `Workspaces` the reference implementation for integrated desktop/mobile density inside the current shell.
- Rebalance the workspace start page toward list-first scanning and factual, low-noise detail summary.
- Rebalance the workspace detail route so the shared content header, primary stage, bottom-area, and right detail use less slack without losing their current role boundaries.
- Make the compact `Messages` room toolbar stable at the fixed `48px` height and `390px` width baseline.
- Remove non-semantic card framing from content areas whose job is density and continuity rather than standalone surface ownership.
- Keep `Avatars / Catalog` list-first while making the selected runtime lens factual, compact, and mobile-safe.
- Make the fixed `New terminal` tab read like a compact task form on both desktop and mobile.
- Encode the new behavior in Storybook DOM / contract coverage so future tweaks do not drift.

**Non-Goals:**

- Do not introduce a new layout primitive or re-open the split-detail law.
- Do not redesign runtime detail shells or terminal detail/runtime inspection in this change.
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

### Preserve explicit button affordance borders while de-framing passive chrome

The previous density pass went one step too far: it treated composer action buttons like passive chrome and stripped their outline borders. That was architecturally wrong. `Attach` and `Screenshot` are explicit clickable actions implemented through the shared `Button` primitive, so their border is part of the control contract, not optional decoration. The correction is to keep dense layout and light backgrounds, but restore the visible outline border and verify it through a real DOM contract.

Alternative considered:

- Keep the borderless actions because the row looks visually lighter.
  - Rejected because the control loses affordance clarity and drifts away from the shared `Button` law.

### Keep the avatar catalog fixed, but collapse runtime-lens card weight and fact sprawl

`Avatars / Catalog` already has the right macro law: one fixed catalog surface plus addable runtime/create tabs. The problem is route-local assembly. The catalog list should stay clearly scannable, but the selected runtime lens needs to stop spending budget on a detached headline chip, a broad empty card, and facts that wrap vertically before the identity and action row settle. The correct move is to preserve the fixed catalog + runtime lens structure while tightening the header facts, compressing action grouping, and turning long ids/paths into dense readable metadata blocks instead of hero chrome.

Alternative considered:

- Rebuild `Avatars / Catalog` on a new split-detail primitive.
  - Rejected because the route already has the correct fixed-surface law; the current issue is card-heavy local composition, not a missing platform primitive.

### Make the fixed new-terminal tab a compact single-task form

`Terminals / New` should feel like a focused creation task, not a sparse landing hero. The fixed `New terminal` tab stays, but the create form needs to consume the page budget more intentionally: the content width should tighten, the field grouping should become denser and more readable, and the primary action should stay visually tied to the form instead of floating in a large empty field of whitespace.

Alternative considered:

- Keep the current composition and only reduce a few margins.
  - Rejected because the main problem is not one padding token; the page currently lacks a compact task hierarchy altogether.

### Remove forced dead space after the first density pass instead of preserving fixed rail/card silhouettes

Once the main density regressions are fixed, the next objective is to remove residual dead space that survives only because the route is still preserving a card-like silhouette. In `Avatars / Catalog`, the fixed catalog behavior should not require a forced empty block when there are only one or two avatars; compact mode should be allowed to collapse to content height while desktop keeps a tighter, explicitly bounded rail. In `Terminals / New`, the route should stop pretending the entire task is a secondary card floating inside `page-content`; the form and defaults rail should read as integrated sections of the page content surface, separated by structure rather than another enclosing card.

Implementation note:

- `Avatars / Catalog` uses a `ScrollView` with a bounded `max-h` rail instead of a forced fixed height, so sparse catalogs collapse naturally while longer catalogs still stay scan-first.
- `Terminals / New` collapses into one dense form band with inline helper copy plus a lower defaults strip, replacing the previous wide empty canvas + side-rail composition.

Alternative considered:

- Keep the current fixed-height catalog rail and whole-form card because they are "stable".
  - Rejected because the remaining problem is no longer stability; it is dead-space preservation and duplicate framing ownership.

### Run a stricter avatar-only de-framing loop before declaring the page visually settled

The current avatar page is now structurally correct, but it still violates the repository's de-framing law at a finer grain. Border and radius are still over-applied to low-value sub-surfaces:

- toolbar metadata facts are expressed as multiple bordered pills
- catalog rows still read like self-owned cards instead of list rows
- runtime state/default facts still compete with the title through pill treatment
- metadata and helper surfaces still spend too many strokes explaining structure that spacing and typography should already explain

The correct move is not another platform rewrite. It is a page-local tightening pass that preserves true affordance borders for actual `Button` controls, while converting passive facts back into text, dividers, and restrained selected-state fills.

Implementation note:

- The avatar workbench toolbar metadata now renders as one textual summary instead of a stack of outline pills.
- Catalog entries now read as selected list rows with restrained fill instead of bordered mini cards.
- Runtime state/default facts now live in compact text, while only the real primary actions keep explicit button borders.
- Runtime metadata now uses row dividers plus label/value structure rather than a boxed grid.

Alternative considered:

- Leave the page as-is because the remaining issue is "only cosmetic".
  - Rejected because this specific page is supposed to serve as a reference for de-framing discipline; allowing border/pill overuse to survive here would weaken the law everywhere else.

### Optimize the page for repeated use, not just first-read explanation

Once the page stops abusing border and radius, the next bottleneck is familiarity. A user who already understands the avatar model does not need the page to keep restating it. Repeated-use tuning should therefore:

- remove duplicate facts that already appear elsewhere on the same page
- keep only one help affordance in the dominant runtime area instead of scattering multiple `?` triggers
- shorten left-rail identifiers into scan cues rather than full raw ids
- hide low-frequency path facts and secondary actions behind a deliberate disclosure instead of keeping them always expanded

Alternative considered:

- Keep all explanation visible because the page might be visited infrequently by some users.
  - Rejected because the current route is an operational surface, not a one-time onboarding page; default chrome should optimize for repeated scanning and launch flow.

### Treat the avatar page like an enterprise workbench, not a soft showcase panel

The next refinement should follow a more IBM-like product instinct:

- repeated route titles should disappear once the workbench tab + toolbar already establish location
- content should use a deliberate readable measure instead of stretching one small facts panel across the whole canvas
- left-rail items should read as dense list rows with clear alignment and restrained selected state, not as rounded soft tiles

This is still a route-local composition change, not a new shell primitive. The platform law already supports it; the page just needs to spend its structure budget more deliberately.

Alternative considered:

- Keep the current soft, wide composition and only tweak colors or spacing.
  - Rejected because the remaining issue is no longer color or density alone; it is the lack of enterprise-grade structural discipline.

### Align refinements back to the repository's existing design language

The avatar route should not invent a parallel visual dialect while tightening density. The correct move is to reuse the repository's existing toolbar and list language:

- top-level page identity should flow through the shared `WorkbenchToolbar` composition model
- catalog scanning should look like the existing workbench list rows already used elsewhere in WebUI, not a bespoke accent-bar list
- metadata labels should keep the project's existing typographic rhythm instead of introducing a new route-only label system

Alternative considered:

- Keep the structurally improved avatar route but allow route-local visual idioms because the page "still works".
  - Rejected because it would fragment the WebUI into multiple competing surface languages and make future tightening less coherent.

### Finish the avatar route by tightening measure and hierarchy inside the existing language

The remaining avatar debt is subtler than before. The route no longer looks ornamental, but it still spends too much of the page budget on repeated location facts and over-wide detail measure:

- the catalog toolbar still risks restating "Catalog" without adding much new context
- the runtime lens stretches wider than the amount of structured information it actually contains
- on compact viewports, status/default facts and primary actions still compete inside the same first-line band

The correct move is still route-local composition, not a new primitive. This follow-up should:

- keep the shared `WorkbenchToolbar content` model, but reduce route-specific subtitle repetition so the toolbar reads more like the repository's other workbench routes
- keep the left rail scan-first while bounding the right lens to a deliberate readable measure on desktop
- stack compact runtime identity facts more naturally so the first viewport stays title-first, with actions following rather than crowding the same horizontal line

Alternative considered:

- Introduce a new avatar-specific toolbar or detail-shell variant to solve the last repetition and spacing issues.
  - Rejected because the shared workbench shell already has the right law; the remaining issue is just how this route spends the layout budget inside it.

### Reframe the avatar catalog as a control tower, not a details page

The avatar catalog is not a generic CRUD screen. Inside the existing `chrome-window`, it should behave like a compact control tower for one global avatar identity system:

- the left rail answers "which durable avatar identity am I acting on?"
- the right lens answers "what is the next best action for this identity right now?"
- low-frequency provenance and branching facts stay reachable, but they should not compete with launch actions in the first viewport

This means the route should optimize for repeated operational use, not first-visit explanation. The primary product story is:

1. choose an avatar identity
2. confirm it is the correct one
3. open or start its canonical runtime
4. branch into adjacent tasks only when needed

Secondary stories must merge back into the same flow:

- create a new avatar draft from the current identity context
- open workspaces already filtered by the current avatar lens
- inspect provenance / path facts only when a debugging or audit need appears

Alternative considered:

- Keep treating the right side as a mini details page with all actions and facts equally visible.
  - Rejected because it obscures the primary launch story and turns the route into a noisy staging surface instead of an operational control tower.

### Replace raw borders with seam language that matches product structure

The current issue is not simply "too many borders". It is that all separations are expressed with the same primitive `border-*`, so the interface only feels cut apart, not intentionally organized.

The route should therefore use three distinct seam roles:

- structural seam: separates catalog rail and runtime lens across the desktop gutter
- section seam: separates major groups inside the runtime lens such as identity/actions vs durable facts
- row seam: separates catalog entries without slicing through the avatar anchor itself

These seams should be implemented through alignment, inset hairlines, and gutter-aware placement rather than full-width raw borders on every container edge.

Alternative considered:

- Keep the same layout and only reduce border opacity.
  - Rejected because it would still leave the page with engineer-style dividers instead of product-level structure cues.

### Dock handoff actions to the selected identity and name facts semantically

After the control-tower pass, one small but meaningful product gap still remains: the secondary actions are present, but they still read slightly like adjacent links rather than branches from the currently selected identity. At the same time, the first canonical fact is still labeled like an implementation field (`Runtime ID`) instead of a user-facing product fact.

The next refinement should therefore:

- dock contextual handoff actions closer to the selected identity on desktop while keeping mobile stacking simple
- keep runtime launch as the primary CTA pair
- rename the first durable fact around product meaning (`canonical runtime`) while still showing the underlying id value
- further align inset seams so the launch lens feels composed rather than merely divided

Alternative considered:

- Keep the current control-tower structure and stop because it is already "good enough".
  - Rejected because this page is acting as a reference surface; if the semantic hierarchy still leaks implementation naming and slightly detached secondary actions, that debt will spread to adjacent workbench pages.

### Promote the first runtime fact into product-led typography

After the semantic rename, one final layout debt remains on desktop: the first durable fact still borrows the same all-caps field-label treatment as the debugging facts below it. That keeps the wording better, but the visual contract still says "implementation field" instead of "primary product fact".

The next refinement should therefore:

- keep the control-tower structure and seam language unchanged
- promote the first durable runtime fact into its own product-led label/value rhythm
- keep lower facts (`Global source`, `Private slot`) in the existing audit-style field language
- avoid introducing a new route-local visual dialect; the result should still feel native to the repository's current toolbar/list language

Alternative considered:

- Move the canonical runtime into the hero row beside the title and launch actions.
  - Rejected because it would overload the first viewport again and force the product fact to compete directly with launch decisions instead of reinforcing them underneath.

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
- [Risk] Tightening avatar catalog facts could make ids and paths harder to recover. -> Mitigation: keep the same facts visible, but demote them into denser metadata blocks and preserve full-text copyability.
- [Risk] Terminal create could become too narrow or too hidden on large screens. -> Mitigation: keep the form centered with a deliberate compact max width, then verify that all required fields and the submit action remain above the fold on desktop and mobile.

## Migration Plan

1. Update the change-local delta specs for `workspace-system-workbench`, `message-system-surface`, `workspace-avatar-management`, and `webui-terminal-surface`.
2. Tighten `Workspaces` start route, detail route, and shared content header.
3. Tighten `Messages` route assembly and compact composer/toolbar evidence.
4. Tighten `Avatars / Catalog` route density without changing its fixed catalog + addable tab law.
5. Tighten `Terminals / New` route density without changing the terminal workbench/tab law.
6. Run targeted WebUI verification (`typecheck`, Storybook DOM coverage where applicable, and visual evidence screenshots).
7. If a regression appears, roll back the route-local density changes without touching the shared shell or tab primitives.

## Open Questions

- Whether the same density tightening should next be promoted into a shared compact-toolbar primitive after `runtime` is evaluated.
- Whether terminal detail and runtime-facing routes should adopt the same “support surface budget” review once the fixed create tab is stable.

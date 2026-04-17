## 1. Workspace Density Tightening

- [x] 1.1 Tighten the shared workspace content header and workspace start route so mobile and desktop stay list-first and context-rich without oversized framing
- [x] 1.2 Tighten the workspace detail route so the main stage, bottom-area, and right detail preserve primary viewport budget on compact screens
- [x] 1.3 Update workspace stories and contract coverage to lock the new density behavior

## 2. Message Toolbar Compact Contract

- [x] 2.1 Tighten the room page toolbar layout so viewer identity, actions, and mode chips remain visible inside the fixed 48px toolbar at the 390px baseline
- [x] 2.2 Update message toolbar story coverage so the compact contract is asserted through real DOM layout checks

## 3. Verification

- [x] 3.1 Run targeted WebUI verification for the touched routes and stories
- [x] 3.2 Capture updated visual evidence and leave the change in an apply-ready state

## 4. Content De-framing Polish

- [x] 4.1 Remove non-semantic card framing from the shared workspace content header and workspace detail support surfaces
- [x] 4.2 Reduce unnecessary rounded/border treatment in dense message room content chrome without breaking the compact toolbar contract
- [x] 4.3 Refresh targeted verification and visual evidence for the de-framed routes

## 5. Room Composer Compactness

- [x] 5.1 Tighten the shared room composer so the draft editor, action rail, and passive metadata stay transcript-first at the 390px mobile baseline
- [x] 5.2 Refresh targeted verification and visual evidence for the composer compaction pass

## 6. Transcript Density Iterations

- [x] 6.1 Iteration 1: reduce transcript viewport padding so the message stream reaches useful height faster
- [x] 6.2 Iteration 2: reduce message row vertical padding and lane gap
- [x] 6.3 Iteration 3: reduce bubble radius and decorative border weight
- [x] 6.4 Iteration 4: remove low-value bubble shadow depth
- [x] 6.5 Iteration 5: tighten bubble inner padding and meta spacing
- [x] 6.6 Iteration 6: tighten desktop bubble width budget so the center lane wastes less space
- [x] 6.7 Iteration 7: reduce footer gradient weight and transition slack
- [x] 6.8 Iteration 8: tighten footer action/hint spacing without breaking the compact composer contract
- [x] 6.9 Iteration 9: re-run desktop/mobile evidence review and adjust the remaining highest-signal density issue
- [x] 6.10 Iteration 10: refresh verification and visual evidence for the transcript-tightening pass

## 7. Button Affordance Correction

- [x] 7.1 Restore visible borders for composer `Attach` and `Screenshot` buttons while keeping the dense footer layout
- [x] 7.2 Add a real DOM contract so compact composer action buttons cannot regress into borderless affordances
- [x] 7.3 Refresh verification and visual evidence for the button-affordance correction

## 8. Avatar Catalog And Terminal Create Density

- [x] 8.1 Tighten `Avatars / Catalog` so desktop and mobile keep catalog scanning primary while selected runtime facts remain readable without oversized card chrome
- [x] 8.2 Tighten `Terminals / New` so the fixed create tab reads like a compact task form instead of a sparse empty canvas
- [x] 8.3 Run targeted verification and refresh desktop/mobile visual evidence for the avatar catalog and terminal create routes

## 9. Dead-Space And De-framing Follow-up

- [x] 9.1 Remove residual forced dead space from `Avatars / Catalog` so compact mode collapses to content height and desktop keeps a tighter catalog rail without preserving a fake empty card body
- [x] 9.2 Remove the route-level whole-form card from `Terminals / New` so the form and defaults rail read as integrated page-content sections instead of a second page inside the page
- [x] 9.3 Run targeted verification and refresh desktop/mobile visual evidence for the follow-up avatar/terminal refinements

## 10. Avatar Chrome De-framing Iterations

- [x] 10.1 Iteration 1: replace the avatar toolbar stats pill row with one low-noise factual summary so the page stops opening with border-heavy metadata chrome
- [x] 10.2 Iteration 2: remove full-card borders from catalog rows and make the list read like a scan-first rail instead of stacked mini cards
- [x] 10.3 Iteration 3: tighten catalog row avatar framing so concentric inset remains correct without double-emphasizing border + radius
- [x] 10.4 Iteration 4: demote runtime hero status/default pills into lower-noise factual text so title hierarchy regains priority
- [x] 10.5 Iteration 5: tighten runtime hero spacing and avatar scale so the primary identity block no longer behaves like a detached card header
- [x] 10.6 Iteration 6: demote secondary runtime actions from pill-like buttons into inline page actions where semantics allow
- [x] 10.7 Iteration 7: reduce metadata divider weight so runtime facts read like structured content, not another bordered surface
- [x] 10.8 Iteration 8: tighten mobile-first section spacing so the first viewport shows more useful identity content before action chrome takes over
- [x] 10.9 Iteration 9: remove remaining low-value rounded/bordered framing from avatar-specific support surfaces without harming real affordances
- [x] 10.10 Iteration 10: run targeted verification and refresh desktop/mobile visual evidence for the avatar-only de-framing pass

## 11. Familiar-User Noise Removal

- [x] 11.1 Remove information that becomes repetitive after repeated use, including duplicate status/count chrome and low-value always-open detail facts on `Avatars / Catalog`
- [x] 11.2 Re-route low-frequency explanations and actions into one restrained secondary path, then refresh verification and screenshots

## 12. IBM-Style Structural Tightening

- [x] 12.1 Remove the remaining repeated top chrome on `Avatars / Catalog`, especially the extra page-toolbar title band that duplicates tab/runtime context on mobile and desktop
- [x] 12.2 Re-measure the avatar catalog layout so desktop stops stretching one small operational panel across a decorative empty field, while the left catalog reads more like a structured enterprise list than a soft card stack
- [x] 12.3 Refresh verification and screenshots for the structural-tightening pass

## 13. Avatar Design-Language Follow-up

- [x] 13.1 Tighten `Avatars / Catalog` back toward the repository's existing toolbar/list language by reducing route-local title repetition and improving compact runtime hierarchy
- [x] 13.2 Re-measure the desktop runtime lens so the page keeps a deliberate right-side reading width instead of a wide empty field
- [x] 13.3 Run targeted verification and refresh desktop/mobile visual evidence for the design-language follow-up

## 14. Avatar Control Tower Iteration

- [x] 14.1 Reframe `Avatars / Catalog` around the primary launch story so the selected runtime lens reads like a control tower instead of a mini details page
- [x] 14.2 Re-introduce contextual secondary actions that branch from the current avatar identity without competing with the runtime launch actions
- [x] 14.3 Replace the remaining raw divider treatment with a clearer seam language for rail, section, and fact grouping
- [x] 14.4 Run targeted verification and refresh desktop/mobile visual evidence for the control-tower iteration

## 15. Avatar Control Tower Follow-up

- [x] 15.1 Dock contextual secondary actions closer to the selected avatar identity so handoff paths feel attached to the current lens rather than floating as a separate row
- [x] 15.2 Rename the first durable runtime fact semantically and refine the remaining seam insets so the launch lens feels more product-led than implementation-led
- [x] 15.3 Run targeted verification and refresh desktop/mobile visual evidence for the control-tower follow-up

## 16. Avatar Primary Fact Typography Follow-up

- [x] 16.1 Promote the primary canonical runtime fact from field-label styling into product-led fact typography without weakening audit readability
- [x] 16.2 Refine the desktop launch-lens spacing so the promoted primary fact feels attached to the launch story instead of appended underneath it
- [x] 16.3 Run targeted verification and refresh desktop/mobile visual evidence for the primary-fact typography follow-up

## 17. Avatar Primary Fact Attachment Follow-up

- [ ] 17.1 Attach the primary canonical runtime fact to the selected identity lane instead of leaving it inside the desktop audit grid
- [ ] 17.2 Preserve the lower `Runtime details` disclosure as the dedicated audit/debug field grid while keeping mobile compact behavior stable
- [ ] 17.3 Run targeted verification and refresh desktop/mobile visual evidence for the primary-fact attachment follow-up

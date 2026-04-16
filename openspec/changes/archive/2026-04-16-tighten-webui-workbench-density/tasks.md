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

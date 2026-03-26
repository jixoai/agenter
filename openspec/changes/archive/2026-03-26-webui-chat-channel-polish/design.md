## Context

The current WebUI already has most of the raw building blocks for this polish pass: `AsyncSurface`, `AdaptiveIconButton`, `SessionStatusPillMenu`, and the new multi-channel chat route. The regressions came from local composition drift instead of missing primitives. Chat channels still hand-roll loading overlays, desktop and mobile use different status affordances, and passive metadata still consumes a dedicated row that competes with transcript space.

This change needs to turn those local fixes into reusable contracts. The result must be implementable through shared primitives plus Storybook DOM coverage so later routes can reuse the same behavior without rediscovering the layout rules.

## Goals / Non-Goals

**Goals:**
- Reuse and refine existing WebUI primitives instead of adding more route-local chrome.
- Make loading, empty, and refreshing states follow one contract across list and panel surfaces.
- Standardize icon-only affordances so collapse behavior preserves spacing, accessible labels, and tooltip fallback.
- Replace passive chat metadata rows with a reusable signal-disclosure pattern that works on desktop and mobile.
- Add component-first Storybook contracts and review guidance so these patterns become future best practices.

**Non-Goals:**
- No message-system security or token model changes in this change.
- No redesign of chat transport or data loading APIs beyond the UI surfaces that consume them.
- No broad shell rewrite outside the status/signal affordances needed for parity.

## Decisions

### 1. Extend existing primitives instead of inventing route-local components
`AsyncSurface` and `AdaptiveIconButton` already exist and are close to the desired behavior. The change will harden them rather than replace them. A new `SurfaceSignalDisclosure` primitive will fill the one missing pattern: compact passive metadata that opens a richer detail surface.

Alternatives considered:
- Add bespoke chat-only metadata and loading components. Rejected because the same defects already recur across multiple panels.
- Push everything into one larger shell component. Rejected because it would hide the reusable affordance contract inside route assembly code.

### 2. Keep passive metadata secondary to tabs and transcript space
Chat-channel metadata is useful, but it is not primary task content. The route will move this information behind a tab-adjacent signal button with tooltip-backed labeling and a dialog disclosure. This preserves the transcript viewport and channel actions as the primary visible content while keeping metadata immediately reachable.

Alternatives considered:
- Keep a dedicated metadata row and only tighten spacing. Rejected because it still spends a full row on secondary facts.
- Hide metadata in an overflow menu. Rejected because metadata inspection needs to stay discoverable and stable, not buried.

### 3. One status affordance model across desktop and mobile
The session status control will use the compact icon-trigger model everywhere. The dropdown remains the action surface, but the trigger itself stops diverging by viewport. This keeps passive header status aligned with the repository rule that redundant text stacks do not belong in shell chrome.

Alternatives considered:
- Preserve the desktop pill trigger for readability. Rejected because it duplicates passive state already present in tooltip-backed icon signals and creates separate visual rules to maintain.

### 4. Storybook primitive contracts are the acceptance gate
Each refined primitive or signal pattern will get a dedicated Storybook story and DOM contract before route-level assembly stories are treated as the final acceptance gate. Layout review evidence will include screenshots plus measurable geometry for compact and desktop variants.

Alternatives considered:
- Rely on route-level screenshots only. Rejected because it lets primitive regressions hide until page assembly.

## Risks / Trade-offs

- [Abstraction drift] -> Keep the new signal disclosure primitive narrowly scoped to passive metadata and require route adoption in the same change.
- [Overfitting to Chat] -> Express the new rules in shared specs and primitive stories so the same components can be reused by other list or detail panels.
- [Compact layout regressions] -> Treat desktop and mobile Storybook + browser evidence as mandatory for the new primitives and the chat route assembly.

## Migration Plan

1. Refine shared UI primitives (`AsyncSurface`, `AdaptiveIconButton`, `Tabs`, new signal disclosure primitive).
2. Adopt those primitives in Chat and shell surfaces, removing duplicate desktop-only status chrome and bespoke loading overlays.
3. Add Storybook DOM contracts for primitives first, then update route-level tests and browser walkthroughs.
4. Sync the resulting best-practice specs so future WebUI work can build on them.

## Open Questions

- None blocked. The remaining work is implementation and verification discipline rather than unresolved product direction.

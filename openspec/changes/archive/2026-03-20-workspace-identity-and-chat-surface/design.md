## Context

The remaining product gaps are no longer isolated component bugs. They span shell navigation, Chat media input, Session and Avatar identity, Devtools readability, and layout contracts across desktop and mobile viewports. The current repository already has workspace-scoped settings, conversation-first Chat, and explicit overflow primitives, but it does not yet distinguish global user settings from workspace settings, does not provide a durable identity-media pipeline, and still allows page-local headers to carry global-entry concerns.

## Goals / Non-Goals

**Goals:**
- Establish a strict shell boundary where the left navigation owns global entry points, including `GlobalSettings`, and `TopHeader` only owns current-page location and local navigation.
- Add a durable identity-media pipeline for Session icons and Avatars, including generated fallbacks, upload APIs, and stable retrieval URLs.
- Complete the Chat media interaction flow with working image upload, preview, and conversation-first expert affordances hidden behind bubble-level context menus.
- Normalize Cycles / Devtools typography, color, tooltip, and scroll behavior so the technical surface remains readable on desktop and on a minimum mobile viewport such as iPhone SE (375x667).
- Extend overflow/layout best practices and supporting primitives so developers can follow safe defaults instead of re-solving scroll and clipping on each screen.

**Non-Goals:**
- Change model/runtime protocol behavior.
- Introduce AI-generated icons yet; this change only prepares upload and retrieval contracts for future use.
- Replace workspace settings with global settings; the two remain separate surfaces with distinct responsibilities.

## Decisions

- Keep navigation responsibilities split by ownership.
  - Decision: the application left rail owns global navigation, running sessions, and the `GlobalSettings` entry; `TopHeader` MUST NOT expose global app entry points.
  - Why: this prevents current-page headers from accumulating unrelated controls and keeps shell navigation predictable.
  - Alternative considered: keep a duplicated GlobalSettings trigger in page headers. Rejected because it pollutes page-local chrome and creates inconsistent entry points.

- Add a dedicated identity-media capability instead of burying icons inside Chat or workspace settings.
  - Decision: Session icons and Avatar images get stable semantic URLs, upload endpoints, and explicit fallback generation rules.
  - Why: Session identity and user/avatar identity are cross-surface assets consumed by navigation, Chat, and settings, so they need their own contract.
  - Alternative considered: generate everything client-side on demand with no upload pipeline. Rejected because it prevents caching durable assets and blocks future AI-generated media workflows.

- Split fallback generation by responsibility.
  - Decision: Session default icons are generated on the client with `OffscreenCanvas` (or a canvas fallback) using workspace and session seeds, then uploaded as `webp`; the server also exposes a default SVG fallback when no uploaded icon exists. Avatar fallbacks are generated server-side as SVG and can later be overridden by uploads.
  - Why: Session icons benefit from rasterized reuse, while Avatar fallbacks are lightweight vector identity assets that the backend can serve consistently across clients.
  - Alternative considered: generate both entirely on the frontend. Rejected because avatar fallback should not depend on frontend availability and because API consumers need a stable media source.

- Keep Chat conversation-first while restoring media completeness.
  - Decision: Chat remains a bubble-first transcript with centered time dividers, while cycle-oriented expert actions are reachable only from bubble context menus / long-press / explicit message action buttons.
  - Why: this preserves ease of use for default conversation reading while keeping expert workflows available.
  - Alternative considered: expose cycle affordances inline in the transcript. Rejected because it regresses the conversation-first contract.

- Normalize technical surfaces through tokens and primitives, not ad hoc classes.
  - Decision: Devtools typography, color density, tooltip usage, and scroll ownership are defined through shared tokens and explicit surface primitives, with tests and browser walkthrough expectations at both desktop and mobile widths.
  - Why: the repeated overflow and oversized-timeline regressions show that local fixes are not enough.
  - Alternative considered: patch each panel individually. Rejected because the same category of bug keeps recurring.

## Risks / Trade-offs

- [This change spans frontend shell, chat UI, and app-server media routes] -> Split implementation into identity-media, shell/settings, and chat/devtools batches with separate Storybook DOM and unit coverage.
- [OffscreenCanvas is not universal] -> Provide a regular canvas fallback for generation while keeping the same seed and upload contract.
- [New media APIs can blur workspace and user ownership] -> Enforce separate URL namespaces and spec language for session media versus avatar media.
- [Layout rules can become too abstract] -> Tie each rule to concrete primitives (`ScrollViewport`, `ViewportMask`, semantic background owners, tooltip wrappers) and verify with source-contract tests plus desktop/mobile walkthroughs.

## Migration Plan

- Add the new media endpoints and fallback handlers before switching UI consumers.
- Introduce the left-nav `GlobalSettings` entry and remove any page-header duplication in the same batch to avoid split navigation states.
- Migrate Chat and Devtools surfaces to the tightened layout primitives incrementally, validating iPhone-SE-sized and desktop viewports after each batch.
- Keep workspace settings data model intact while adding the global user-settings surface beside it.

## Open Questions

- Whether Session icon generation should happen eagerly at session creation time or lazily on first render.
- Whether screenshot capture for Chat should start with browser Screen Capture only or include a backend capture pipeline in a follow-up change.

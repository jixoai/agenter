## Context

The current worktree already contains a Framework7 Svelte review shell under `packages/web-chat-view/example`. A prior audit report was produced at `.screenshot/after/room-management-multisystem-audit-20260528/index.html`; that report found three concrete defects:

- Framework7 icons leak as visible text on desktop/mobile route screenshots.
- iPhone source detail can appear as a half-open or offset child page, leaving the previous surface visible.
- `capture-review-overlays.ts` fails on the `Open Image 1` token locator, so the overlay proof cannot be trusted.

The larger architecture direction remains: a room may connect to multiple message-system instances and Studio may expose low-emphasis Source/Domain metadata, but `web-chat-view` should stay ordinary-user-facing. This change only fixes review-shell correctness and evidence.

## Goals / Non-Goals

**Goals:**

- Preserve official Framework7 shell ownership instead of replacing it with custom navigation/layout primitives.
- Make icon rendering deterministic in the example and shared package routes.
- Make mobile child pages route-owned and visually complete in iPhone 14 screenshots.
- Make overlay entrypoints accessible and automation-stable for inline tokens and resource tiles.
- Produce a fresh HTML report with screenshots after the fixes.
- Run at least two self-review passes against original findings and spec goals.

**Non-Goals:**

- Do not implement the full room-management/message-system decoupling here.
- Do not redesign source/domain IA beyond fixing misleading or broken evidence surfaces.
- Do not add compatibility glue for old message-system databases.
- Do not treat screenshots as a replacement for BDD; screenshots are final evidence, not the only regression guard.

## Decisions

### Decision 1: Keep this as a dedicated follow-up change

The architecture change `decouple-room-management-from-message-system` remains the long-term system-law change. This follow-up change fixes the concrete review-shell defects that block trustworthy UI evidence.

Rejected alternative: mix these fixes into the architecture change. That would make task progress ambiguous and hide UI proof failures behind unrelated room-management work.

### Decision 2: Test visible contracts, not private implementation details

BDD will assert user-observable behavior:

- no raw icon names in visible text
- child page is active and root tabbar is absent on mobile child surfaces
- token and tile entrypoints are accessible and open the same preview layer

Source-file assertions may remain as lightweight guards for official Framework7 topology, but the repair must be validated through DOM/route behavior where possible.

### Decision 3: Prefer Framework7 official topology and runtime-owned temporary views

If a defect comes from missing runtime resources or incorrect router state, fix that layer. Do not solve it by replacing Framework7 `View/Page/Navbar/Toolbar/List/Icon/Actions/Popup/Sheet` with private equivalents.

### Decision 4: HTML report is a generated review artifact

The final report SHALL live under a dated worktree-local screenshot folder and SHALL reference the actual screenshots from the same run. The report should tell the product story in plain language: what was broken, what was fixed, and what remains architecture-deferred.

## Risks / Trade-offs

- [Risk] The example is a nested app and dependency resolution can drift from the root workspace. → Mitigation: run scripts from the root/workspace path where Bun can resolve workspace packages, and keep Vite fs/dependency configuration explicit if needed.
- [Risk] Screenshots may pass while automation silently clicks the wrong surface. → Mitigation: BDD verifies accessible labels and active route state before screenshots are captured.
- [Risk] Icon repairs may mask a missing font path rather than fixing it. → Mitigation: verify both DOM text and screenshots, and ensure Framework7 icon font CSS/assets are reachable through the example dev server.
- [Risk] Mobile child route repairs could regress desktop split view. → Mitigation: capture both desktop and iPhone 14 states in the same report.

## Self-Review Gates

- Review A: after failing BDD is written, confirm every test maps to one original report finding.
- Review B: after implementation passes targeted tests, inspect whether fixes preserve Framework7 official ownership and do not invent hidden message-system architecture.
- Review C: after screenshots/report generation, compare the new report against original goals and list any remaining defects as explicit follow-up items.

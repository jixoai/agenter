## Context

The repository already contains most of the primitives needed for this upgrade, but they are split across different maturity levels. The current Svelte shell already has workbench tabs and toolbar primitives, yet `app-shell.svelte` still injects a redundant top header and stale refresh controls. `@agenter/web-chat-view` already owns the transport shell, but its current composer and message row are intentionally minimal and lag far behind the React-era `AIInput` and `MessageChannelBubble` implementations kept in `packages/webui-bak`. The icon stack also already has a real authority in `profile-service`, but it only models `profile` and `session` owners, which means Messages cannot ask the canonical authority for room tab or room transcript icons.

The room attachment story is similarly half-finished. `message.globalSend` and `RuntimeStore.sendGlobalRoomMessage(...)` already accept `assetIds`, but `AppKernel.sendGlobalRoomMessage(...)` currently discards them. Session chat uploads already use an HTTP multipart endpoint outside tRPC, so the cleanest way to finish room attachments is to add a parallel room-owned media contract instead of tunneling blobs through feature-local hacks.

## Goals / Non-Goals

**Goals:**
- Remove redundant global shell chrome and let each selected workbench behave like one switched Chrome-like window.
- Make objective workspace path formatting a shared law instead of per-route string slicing.
- Extend profile-service-backed icon authority to typed entity owners, with room icons shipped first.
- Restore the richer shared chat/composer surface in `@agenter/web-chat-view` and use it from Messages.
- Add a real room media upload/send/render path so room attachments and screenshots work end to end.
- Keep OpenSpec, durable specs, and tests aligned with the implementation instead of leaving this change as code-only drift.

**Non-Goals:**
- Rewrite the room grant or auth identity model into a brand-new universal key system in this change.
- Replace the existing workbench/tab primitives with a new navigation framework.
- Rework session chat media ownership; this change only adds the missing room-owned parallel contract.
- Fold all possible entity kinds into the first icon slice; room is mandatory, terminal/task stay forward-compatible but may remain fallback-only in v1.

## Decisions

1. **Use one new OpenSpec change rather than extending already-complete tab work**
   - The previously completed workbench/tab change already has a closed scope.
   - This upgrade crosses shell, icon authority, shared chat, and media transport, so it needs a new change with its own specs and tasks.

2. **Remove the global top bar instead of trying to make it useful**
   - `app-shell.svelte` will stop rendering the `Agenter / active title / connected as / refresh` header row.
   - Sidebar toggle, page title, metadata, and local actions move into workbench-local chrome.
   - Rationale: the shell header duplicates route chrome, creates layout breakage, and fights the window-switcher model the user explicitly wants.

3. **Promote objective workspace path formatting into a shared helper**
   - Introduce one formatter that returns compact labels, full labels, and the normalized `~/.agenter` form for the global workspace.
   - Apply it to workbench lists, tabs, headers, and settings detail titles.
   - Rationale: path semantics are currently inconsistent and should not be rebuilt in each route.

4. **Extend icon authority through typed entity owners instead of feature-local room avatars**
   - `profile-service` will grow typed icon owner routing, storage, and fallback rendering with `room` implemented first.
   - `client-sdk` and WebUI consume dedicated helpers such as `roomIconUrl()` rather than inventing local initials or label-based fallbacks.
   - Rationale: room icons are not a Messages-only concern; they are the first concrete consumer of a more correct underlying law.

5. **Keep room media upload parallel to session media upload**
   - Add room media multipart HTTP endpoints analogous to `/api/sessions/:sessionId/assets`.
   - `message.globalSend` continues to carry only metadata ids; uploads remain HTTP media operations rather than tRPC blobs.
   - Rationale: this matches the current transport law and avoids forcing binary upload concerns through a request path that already assumes metadata-only send.

6. **Upgrade `@agenter/web-chat-view` by porting the React-era behavior, not by re-inventing new feature-local widgets**
   - Port the proven `AIInput`, composer toolbar/status, attachment strip, and message bubble behaviors into Svelte/shared package form.
   - Add explicit host hooks for canonical avatar/icon resolution and message action menus.
   - Rationale: the React package already encodes the correct conversation/composer law and reduces design drift.

7. **Let Messages consume the shared chat atom and own only room-specific orchestration**
   - `message-room-route.svelte` remains responsible for room auth, selected viewer, manage dialog, upload/send orchestration, and read-state updates.
   - `@agenter/web-chat-view` owns transcript/composer visuals, attachment rendering, and local interaction affordances.
   - Rationale: this preserves orthogonality between room orchestration and generic chat presentation.

## Risks / Trade-offs

- [Risk] Extending icon authority to typed entities could overreach into authorization design. → Mitigation: scope v1 to room ownership plus forward-compatible routing; do not redesign grants or auth identity semantics.
- [Risk] Room media upload could duplicate too much session asset code. → Mitigation: extract shared attachment-store helpers and keep only owner namespace differences at the API edge.
- [Risk] Porting richer chat primitives into Svelte may reintroduce layout regressions. → Mitigation: keep transcript/composer layout on shared `Scaffold`/`ScrollView` primitives and cover desktop/mobile via Storybook DOM + Playwright.
- [Risk] Dirty worktree changes in nearby files can make integration brittle. → Mitigation: read before editing, avoid reverts, and only touch the minimum shared surfaces needed for this change.

## Migration Plan

1. Add the OpenSpec deltas and implementation tasks.
2. Refactor shell/window formatting helpers first so route chrome can consume the new law without temporary duplication.
3. Add typed entity icon authority and room icon consumption, keeping existing session/profile helpers backward-compatible.
4. Add room media upload/retrieval plus room attachment send persistence.
5. Port richer `web-chat-view` composer/message behavior and connect Messages to the new room asset flow.
6. Update durable specs and verification suites before declaring the change complete.

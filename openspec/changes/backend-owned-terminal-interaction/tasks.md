## 1. Baseline Evidence And Contracts

- [ ] 1.1 Record code-evidence in `.chat/backend-owned-terminal-interaction/opening-architecture.md`: current Ghostty terminal-core selection APIs, current `ghostty-native` wrapper gaps, and current OpenTUI host-local selection ownership.
- [ ] 1.2 Add shared backend interaction types in `@termless/core` for capabilities, owner coordinates, pointer events, selection ranges, overlays, semantic selection, copy, and cursor-follow.
- [ ] 1.3 Add BDD unit tests proving backend capability facts distinguish backend-native, backend-adapter-owned, unavailable, and host-projection-only behavior.
- [ ] 1.4 Update durable package exports so terminal-system and cli-shell consume the shared interaction types without importing product-specific modules.

## 2. Ghostty-native Backend Interaction

- [ ] 2.1 Add Zig N-API exports for Ghostty terminal-core selection: clear selection, select range, select word, select line, selection text, and visible selection overlay/range.
- [ ] 2.2 Convert Ghostty screen/viewport coordinates to the shared backend interaction coordinate contract with explicit bounds checks and no `any` casts in TypeScript.
- [ ] 2.3 Add TypeScript wrapper methods in `@termless/ghostty-native` and expose `TerminalInteractionCapabilities`.
- [ ] 2.4 Add backend tests proving Ghostty-native selected text comes from terminal-core `selectionString` behavior, including wrapped text and wide characters.
- [ ] 2.5 Add backend tests proving Ghostty-native selection moves or clears with scrollback mutation instead of sticking to old viewport rows.
- [ ] 2.6 Add backend tests proving Ghostty-native word and line selection are computed by backend APIs rather than host text snapshots.

## 3. Backend Adapter Path

- [ ] 3.1 Add a generic backend interaction adapter for backends without native selection, storing selection in backend/offscreen-renderer coordinates rather than OpenTUI screen coordinates.
- [ ] 3.2 Implement selected-text extraction in the adapter using backend line/cell reads with terminal-width-aware slicing.
- [ ] 3.3 Implement ICU-based word selection in the adapter using `Intl.Segmenter(undefined, { granularity: "word" })` and `isWordLike`.
- [ ] 3.4 Add adapter tests for CJK, emoji/wide glyphs, wrapped rows, empty rows, and bounded owner selection.
- [ ] 3.5 Mark the adapter as backend-adapter-owned in capability facts so consumers do not confuse it with backend-native Ghostty behavior.

## 4. Runtime And Transport

- [ ] 4.1 Extend terminal frame/projection payloads with backend-owned selection overlays and active owner metadata.
- [ ] 4.2 Extend terminal transport protocol and direct endpoint with semantic interaction messages for selection lifecycle, semantic selection, copy selection, clear selection, cursor-follow, and paste/resize routing where needed.
- [ ] 4.3 Ensure direct in-process transport passes structured interaction values or fast clones, while WebSocket serialization remains a transport implementation detail.
- [ ] 4.4 Thread backend interaction APIs through `XtermReadableBridge`, managed terminal runtime, projection/composed terminal runtime, and terminal control-plane surfaces without product-specific imports.
- [ ] 4.5 Add BDD integration tests for event path causality: host event -> transport/direct endpoint -> backend action -> frame overlay publication.
- [ ] 4.6 Add BDD integration tests for cursor-follow causality: accepted input -> backend followCursor -> backend-published viewport result.

## 5. Cli-shell Projection Refactor

- [ ] 5.1 Refactor `BackendFrameRenderable` / shell projection so OpenTUI no longer owns durable `#selection`, `#dragSelection`, `#semanticSelection`, or selected-text extraction for backend terminal content.
- [ ] 5.2 Make OpenTUI projection capture events, map owner coordinates, send backend interaction messages, and render backend-provided overlays only.
- [ ] 5.3 Update native copy handling so `Command+C` and `Ctrl+Shift+C` request selected text from the active backend owner and deliver it through OSC 52 or the configured native clipboard adapter.
- [ ] 5.4 Update paste/input handling so accepted shell input and supported navigation request backend cursor-follow, with no frontend viewport-target fallback as primary behavior.
- [ ] 5.5 Implement strict semantic click clustering in projection event routing: same owner, same backend row, same button, x drift at most one cell, y must not cross row.
- [ ] 5.6 Update Option+Left/Right routing so word navigation reuses backend-aware word-boundary behavior or native terminal sequences, then requests backend cursor-follow after success.
- [ ] 5.7 Remove or quarantine old OpenTUI selection simulation tests and replace them with backend-owner BDD tests.

## 6. Dialogue / Terminal-chat Interaction

- [ ] 6.1 Add or wire an independent dialogue backend/offscreen-renderer owner for terminal-chat selection, copy, scroll, cursor, wrapping, and overlay publication.
- [ ] 6.2 Route dialogue pointer, drag, wheel, keyboard, paste, and copy events through the same backend interaction bridge used by shell projection.
- [ ] 6.3 Support hidden dialogue scrollbar chrome without removing dialogue scroll/copy/selection truth.
- [ ] 6.4 Add BDD tests proving shell selection cannot cross into dialogue and dialogue selection cannot change shell selection or cursor truth.
- [ ] 6.5 Add BDD tests proving dialogue selected text copies from dialogue owner and shell selected text copies from shell owner.

## 7. Debugging And Manual Acceptance Artifacts

- [ ] 7.1 Extend `--debug=*FILTER*` support with targeted `selection`, `follow`, `key`, and `scroll` traces that show owner, backend coordinates, backend action, publication sequence, and viewport result.
- [ ] 7.2 Create `.chat/backend-owned-terminal-interaction/native-manual-acceptance.md` in plain Chinese with test points the user can answer with “符合/不符合 + 问题”.
- [ ] 7.3 Include manual acceptance cases for selecting then scrolling, shell cursor-follow after input/navigation/Home/End/Option arrows, double/triple click drift reset, shell copy, dialogue copy, and owner-bounded selection.
- [ ] 7.4 Record automated evidence in `.chat/backend-owned-terminal-interaction/automation-results.md` with commands, pass/fail status, and remaining manual-only gaps.

## 8. Verification And Cleanup

- [ ] 8.1 Run `openspec validate backend-owned-terminal-interaction --strict` before implementation and after final edits.
- [ ] 8.2 Run focused backend interaction tests for Ghostty-native and generic adapter behavior.
- [ ] 8.3 Run terminal transport protocol tests covering semantic interaction messages and frame overlay payloads.
- [ ] 8.4 Run cli-shell BDD/unit tests covering owner routing, copy, cursor-follow, semantic click clustering, Option navigation, and debug filters.
- [ ] 8.5 Run typecheck for touched packages with no new `any`, `as any`, or `@ts-nocheck`.
- [ ] 8.6 Run `git diff --check` and review the diff for removal of obsolete host-local selection ownership.
- [ ] 8.7 Update relevant durable `SPEC.md` or package `SPEC.md` summaries if implementation changes long-term platform law.

## 1. Specification And Baseline

- [x] 1.1 Validate `polish-cli-shell-terminal-interactions` OpenSpec artifacts with `openspec validate polish-cli-shell-terminal-interactions --strict`.
- [x] 1.2 Add BDD tests for shell keyboard input following the backend cursor when viewport is scrolled away.
- [x] 1.3 Add BDD tests for double-click word selection using CJK/ASCII mixed content and `Intl.Segmenter` semantics.
- [x] 1.4 Add BDD tests for triple-click row selection staying inside the active shell/dialogue region.
- [x] 1.5 Add BDD tests proving shell scrollbar progress visibly changes from backend state while click/drag still sends viewport target requests.

## 2. Interaction Implementation

- [x] 2.1 Update shell keyboard input routing so successful terminal input calls the existing backend follow-cursor bridge.
- [x] 2.2 Implement word and row semantic selection state inside `BackendFrameRenderable`, sharing the existing bounded selection paint/copy path.
- [x] 2.3 Implement terminal-column to string-index conversion helpers so `Intl.Segmenter` works with wide glyphs and cell coordinates.
- [x] 2.4 Add click-count handling for double-click and triple-click gestures using OpenTUI mouse event facts with a fallback cadence tracker.
- [x] 2.5 Update scrollbar projection options or rendering so backend scroll progress is visible without adding compositor-owned scrollbar truth.

## 3. Validation And OpenSpec Closure

- [x] 3.1 Run focused cli-shell TUI tests covering the new interaction scenarios.
- [x] 3.2 Run `bun run --filter '@agenter/cli-shell' typecheck` and `bun run --filter '@agenter/cli-shell' test`.
- [x] 3.3 Run affected transport/projection regression tests if implementation touches shared terminal contracts.
- [x] 3.4 Sync durable spec changes to `openspec/specs/terminal-screen-projection-law/spec.md` and `openspec/specs/cli-shell-app/spec.md`.
- [x] 3.5 Archive this change after verification.

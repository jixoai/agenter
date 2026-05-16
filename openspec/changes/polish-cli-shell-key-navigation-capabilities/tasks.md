## 1. Spec and Architecture

- [x] 1.1 Validate `polish-cli-shell-key-navigation-capabilities` OpenSpec artifacts with `openspec validate --strict`.
- [x] 1.2 Add or update durable spec summaries for cli-shell interaction capabilities and terminal projection key navigation.

## 2. Interaction Capability Layer

- [x] 2.1 Add a product-local cli-shell interaction capability profile and backend recommendation map.
- [x] 2.2 Wire the recommendation profile into native and web cli-shell startup/TUI construction without touching core terminal-system policy.
- [x] 2.3 Add focused BDD tests for backend recommendation defaults and fallback behavior.

## 3. Terminal Word Navigation Helpers

- [x] 3.1 Extract terminal word segmentation and terminal column/string index conversion into a pure helper.
- [x] 3.2 Update semantic double-click word selection to use the shared helper without regressing triple-click row selection.
- [x] 3.3 Add BDD tests for English, CJK, punctuation, and double-width column mapping.

## 4. Key Encoding and Cursor Follow

- [x] 4.1 Expand terminal key encoding coverage for the supported key matrix, including Home/End fallback and native sequence precedence.
- [x] 4.2 Implement Option+Left/Right word navigation using the shared word-boundary helper when enhancement is enabled.
- [x] 4.3 Ensure successful printable and navigation shell input requests `LiveTerminalMirror.followCursor()` while failed input does not.
- [x] 4.4 Add BDD tests for key matrix routing, cursor-follow behavior, and Option+Left/Right word navigation.

## 5. Verification and Closure

- [x] 5.1 Run focused cli-shell tests for TUI input, backend frame selection, live mirror cursor follow, and capability recommendations.
- [x] 5.2 Run `bun run --filter '@agenter/cli-shell' typecheck` and `bun run --filter '@agenter/cli-shell' test`.
- [x] 5.3 Run `openspec validate polish-cli-shell-key-navigation-capabilities --strict`.
- [x] 5.4 Provide a short manual acceptance checklist in plain Chinese for Ghostty/native走查.

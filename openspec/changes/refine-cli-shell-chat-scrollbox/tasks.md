## 1. Baseline Evidence And Red Tests

- [x] 1.1 Add failing cli-shell BDD tests proving dialogue wheel down moves toward newer/lower content and wheel up moves toward older/upper content.
- [x] 1.2 Add failing cli-shell BDD tests proving native Chat uses an OpenTUI `ScrollBox`/scrollbar primitive or a thin explicit wrapper as the accepted message-list viewport owner.
- [x] 1.3 Add failing cli-shell BDD tests proving `dialogueScrollOffset` is not exposed as the dialogue scroll authority in the TUI model or host bridge.
- [x] 1.4 Add failing cli-shell BDD tests proving near-top scrolling calls `pageGlobalRoomMessages({ chatId, before: nextBefore, limit })`.
- [x] 1.5 Add failing cli-shell BDD tests proving prepending older messages preserves the first stable visible message anchor.
- [x] 1.6 Add failing cli-shell BDD tests proving bottom-pinned Chat follows new messages while scrolled-up Chat preserves reader position and shows the return-to-bottom affordance.

## 2. Message Window State

- [x] 2.1 Introduce a cli-shell Chat loaded-window model containing loaded message ids, `nextBefore`, `hasMoreBefore`, `loadingBefore`, pinned state, and anchor metadata.
- [x] 2.2 Merge snapshot, page, and incremental room updates by durable message id while preserving stable chronological order.
- [x] 2.3 Remove or demote `dialogueScrollOffset` from public TUI model/state so it cannot remain the product scroll law.
- [x] 2.4 Ensure successful dialogue send clears only the draft, keeps the dialogue open, and returns to bottom-pinned mode.

## 3. OpenTUI ScrollBox Integration

- [x] 3.1 Replace the self-painted dialogue message-list scrollbar with OpenTUI `ScrollBox` built-in scrollbar semantics or a controlled OpenTUI scrollbar wrapper.
- [x] 3.2 Route dialogue wheel, keyboard, and scrollbar interactions into the ScrollBox-facing adapter with one normalized direction convention.
- [x] 3.3 Add semantic edge detection for near-top loading and bottom-pinned state based on ScrollBox `scrollTop`, `scrollHeight`, and viewport height.
- [x] 3.4 Implement anchor capture before prepend and anchor restoration after layout settles.
- [x] 3.5 Keep shell-terminal viewport scrolling and Chat transcript scrolling as independent owners with no shared `dialogueScrollOffset` fallback.

## 4. MessageRoom Pagination Wiring

- [x] 4.1 Wire native cli-shell Chat older-history loading through the existing client SDK `pageGlobalRoomMessages` path.
- [x] 4.2 Ensure authorization errors, empty pages, stale cursors, and duplicate page results are surfaced as recoverable product states, not crashes.
- [x] 4.3 Ensure incremental room updates update existing loaded messages in place when message lifecycle records change.

## 5. Cleanup

- [x] 5.1 Delete or reduce self-painted dialogue scrollbar code to non-authoritative test/debug projection only.
- [x] 5.2 Update cli-shell TUI tests that asserted exact reverse-offset glyph math into behavior tests around host scroll semantics.
- [x] 5.3 Update durable docs/comments near the Chat scroll adapter to state the law: MessageRoom owns transcript truth, OpenTUI owns native viewport mechanics, cli-shell owns only the loaded window projection.

## 6. Validation

- [x] 6.1 Run focused cli-shell TUI tests for Chat scrolling, pagination, anchor preservation, and bottom pinning.
- [x] 6.2 Run focused cli-shell web-host tests only where shared room pagination helpers changed; do not add WebUI coupling.
- [x] 6.3 Run `bun run --filter '@agenter/cli-shell' typecheck`.
- [x] 6.4 Run `openspec validate refine-cli-shell-chat-scrollbox --strict`.
- [x] 6.5 Run `openspec validate --specs --strict`.
- [x] 6.6 Run `git diff --check`.

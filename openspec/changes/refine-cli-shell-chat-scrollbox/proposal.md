## Why

Cli-shell Chat currently treats transcript scrolling as app-local offset math, including `dialogueScrollOffset` as "rows away from the bottom" and a hand-drawn scrollbar. That is the wrong app law: MessageRoom already owns durable room history and pagination, while OpenTUI already provides native scroll containers and scrollbar primitives.

This change corrects the Chat scroll architecture before more behavior is built on top of it. The dialogue panel should load room history incrementally into a host-native scroll container, preserve anchors when older rows are prepended, and stop pretending that a manually computed row offset is the source of scroll truth.

## What Changes

- **BREAKING**: Replace cli-shell Chat's app-local `dialogueScrollOffset` law with a native host scroll container law for the message list.
- **BREAKING**: Native cli-shell Chat SHALL use OpenTUI `ScrollBox`/scrollbar semantics, or an equivalent explicit OpenTUI primitive, as the message-list viewport owner instead of a self-painted scrollbar plus manual reverse-offset math.
- The Chat message list keeps only view-window state over MessageRoom truth: loaded message ids, `nextBefore`, `hasMoreBefore`, loading status, pinned-to-bottom status, and an anchor for prepend stabilization.
- When the user scrolls near the older-history edge, cli-shell pages older room messages through the message control plane / client SDK and prepends them into the loaded window.
- Prepending older messages preserves the first stable visible message anchor instead of jumping the viewport.
- New messages follow the bottom only while the Chat view is pinned to bottom; if the user has scrolled upward, the viewport remains anchored and cli-shell exposes the existing compact return-to-bottom/new-message affordance.
- Successful user send returns Chat to bottom-pinned mode and clears only the draft.
- The visible Chat scrollbar remains independent from the shell-terminal viewport scrollbar and independent from backend terminal viewport truth.
- WebUI is not coupled to this change. Web hosts may reuse the same MessageRoom pagination semantics, but this change only repairs cli-shell native Chat behavior.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cli-shell-app`: refine the dialogue/transcript scroll law so native cli-shell Chat uses host-native OpenTUI scroll container semantics, incremental MessageRoom pagination, and anchor-preserving prepend behavior instead of app-local reverse-offset math.
- `message-chat-control-plane`: clarify that room snapshot, page reads, and incremental transport updates are the durable source for Chat history windows, including cli-shell incremental loading.

## Impact

- `openspec/specs/cli-shell-app/spec.md`
- `openspec/specs/message-chat-control-plane/spec.md`
- `packages/cli-shell/src/tui/*`
- `packages/client-sdk/src/runtime-store.ts`
- `packages/message-system/src/message-control-plane.ts`
- Focused BDD tests under `packages/cli-shell/test/*`

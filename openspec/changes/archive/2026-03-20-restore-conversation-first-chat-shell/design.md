## Context

The repository already has most of the building blocks we need: a workspace shell, a shared AI input built on CodeMirror, a dedicated Devtools route, ephemeral notification state, and dual desktop/mobile E2E coverage. The regression comes from the composition layer. `WorkspaceChatRouteView` still fetches both messages and cycles, but `ChatPanel` renders from `projectConversationSections(cycles, aiStatus)`, which reintroduces cycle rails and cycle section chrome. At the same time, unread counts are derived from real assistant `to_user` messages, but the current E2E harness keeps emitting repeated attention-driven replies, so the UI exposes inflated but technically valid unread counts. Hot runtime bursts also propagate too broadly through the shell, which lines up with the profile showing excessive async task churn and frequent React work while the app is otherwise idle.

## Goals / Non-Goals

**Goals:**
- Restore a strictly conversation-first Chat surface on desktop and compact layouts.
- Keep cycle inspection available, but only through Devtools and explicit advanced actions on messages.
- Preserve real unread-per-message semantics while fixing the publication and harness behavior that currently inflates those counts.
- Rebalance the workspace shell so global header, workspace context, route content, and bottom navigation each own one layer of information without duplication.
- Reduce unnecessary rerenders from runtime activity by narrowing selector scope and stabilizing derived projections.

**Non-Goals:**
- Redesigning LoopBus or changing cycle persistence semantics.
- Changing the durable session schema beyond adding cycle linkage to runtime chat projections.
- Replacing CodeMirror or the existing AI input surface.
- Introducing a new notification product beyond the existing ephemeral runtime projection.

## Decisions

- **Make Chat message-first and keep cycle linkage as metadata.** `RuntimeChatMessage` will carry `cycleId: number | null`, and the route will render Chat directly from messages plus streaming state. This preserves message-to-cycle jumps without keeping Chat cycle-backed. The alternative was to keep cycle-backed Chat and visually hide cycle chrome, but that still leaks the wrong mental model and complicates unread consumption.
- **Hide cycle access behind advanced message actions.** Chat messages will expose menu-based expert actions (`Copy Markdown`, `Copy Text`, `View in Devtools`) through a button on desktop and long-press/menu on compact layouts. The alternative was a persistent cycle affordance beside every row, but that keeps surfacing technical vocabulary in the primary reading flow.
- **Consume notifications from the last visible assistant `to_user` message in the message-first viewport.** The current behavior is conceptually correct but uses a route projection that no longer matches the desired Chat model. The alternative was collapsing unread semantics to one badge per session, but the user explicitly chose real per-message counts.
- **Keep shell hierarchy strict and compact.** The global header owns only app identity, location, passive transport state, and the mobile navigation trigger. The workspace shell owns the workspace context strip and route tab switcher. Chat owns session controls and route notices. The alternative—keeping workspace/session facts in both header and route chrome—creates the duplication visible in current screenshots.
- **Fix harness amplification instead of weakening production semantics.** The E2E/mock server will emit one stable assistant reply for the default conversation path so automated runs stop manufacturing unread storms. The production unread model stays per-message and remains verified separately.
- **Tighten runtime publication by stabilizing selectors and projections.** Route and shell surfaces will subscribe only to the slices they render, and expensive projections such as Chat rows will be memoized from session-local inputs. The alternative—tuning Markdown or component internals first—would treat the symptom instead of the source of hot repaints.

## Risks / Trade-offs

- [Adding `cycleId` to runtime chat messages touches multiple packages] → Thread the change through typed interfaces first, then update projections and tests in one pass.
- [Message-first Chat could lose access to technical context] → Keep explicit `View in Devtools` actions on assistant rows and verify deep-link selection in DOM/E2E coverage.
- [Unread counts may still look large in real long-running sessions] → Preserve true counts but clamp only the visual badge treatment if necessary; do not alter the underlying semantics.
- [Shell hierarchy refactors can break scrolling again] → Keep one explicit scroll owner per surface and cover both desktop and mobile shells with Storybook DOM plus Playwright.
- [Runtime publication fixes can be subtle] → Use targeted runtime-store tests and the existing performance profile as a regression baseline before and after the changes.

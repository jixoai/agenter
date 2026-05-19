## 1. OpenSpec And Durable Docs

- [x] 1.1 Review `interaction.md` and `interaction-prototype.html` with the user before implementation; update the change if the permission story changes.
- [x] 1.2 Update delta specs for terminal authorization, managed seat authority, runtime terminal tools, WebUI, terminal-view components, cli-shell, Shell Assistant, product-extension runtime, and client runtime store.
- [x] 1.3 Update durable `SPEC.md` files after implementation so long-term docs use `guard` and no longer present `requester` as canonical truth.
- [x] 1.4 Update durable `SPEC.md` files after implementation so live permission requests are TerminalInstance-bound state with filterable subscriptions, not a product database.
- [x] 1.5 Update durable `SPEC.md` files after implementation so cli-shell managed/takeover is documented as attention-backed product state, not TerminalSystem authority or product write delegation.
- [x] 1.6 Update durable `SPEC.md` files after implementation so `ProductDelegation` is not documented as the current product-extension runtime authorization contract.
- [x] 1.7 Update durable `SPEC.md` files after implementation so TerminalSystem composed surfaces are product-opaque terminal frames, not cli-shell toolbar/dialogue/managed state.
- [x] 1.8 Run `openspec validate add-terminal-guard-authorization-mode --strict`.

## 2. TerminalSystem Core

- [x] 2.1 Rename public terminal grant role `requester` to `guard` across terminal-system types, control-plane authorization, database normalization, approval routing, and write lease projection.
- [x] 2.2 Add a one-time local migration or cleanup path for persisted `requester` grants and approval fixtures.
- [x] 2.3 Update control-plane tests so guard writes create approval requests, equivalent pending requests coalesce, approvals mint leases, denied/expired requests require fresh approval, and readonly cannot request guarded writes.
- [x] 2.4 Update managed seat authority mapping to include `GUARD` and map it to the terminal-native guard grant.
- [x] 2.5 Refactor composed terminal surface contracts so TerminalSystem accepts generic frame data and product-opaque metadata instead of fields such as `managedLabel`, `dialogueDraft`, `unreadLabel`, `heartbeatLabel`, or `托管` defaults.
- [x] 2.6 Add a focused core-boundary test preventing cli-shell-specific composed-surface tokens from reappearing in `packages/terminal-system/src`.
- [x] 2.7 Add short boundary comments near the composed surface type/publisher explaining that TerminalSystem transports product-rendered frames and must not learn product chrome semantics.
- [x] 2.8 Add TerminalSystem permission request subscription support with optional `terminalId` filter.
- [x] 2.9 Bind unresolved permission request executability to the live TerminalInstance; terminal death/rebootstrap must cancel or expire old pending requests so they cannot mint leases for a new instance.
- [x] 2.10 Add TerminalSystem tests for all-terminal subscription, terminal-id filtered subscription, server-side visibility filtering, and stale request invalidation after terminal kill/rebootstrap.

## 3. Runtime/API/Client Contracts

- [x] 3.1 Update TRPC/app-kernel terminal routes and client SDK types to use `guard`.
- [x] 3.2 Update runtime terminal `write` and `input` handlers so guard calls request approval when appropriate, return structured `approvalRequest` facts, reuse equivalent pending requests, and preserve denied/expired outcomes as authorization results.
- [x] 3.3 Update descriptor schemas/help and generated runtime skill content so AI callers understand guard approval as pending work, denied/expired approval as terminal-local non-execution, and existing pending requests as blockers to wait/report rather than duplicate.
- [x] 3.4 Update `RuntimeStore` normalization, approval refresh, grant issue/revoke, and lease projection tests to use guard.
- [x] 3.5 Remove active `ProductDelegation` schemas, app-server store/routes/kernel methods, client SDK store methods, and product-extension client methods from the current public runtime contract.
- [x] 3.6 Delete or ignore existing local product delegation JSON data created by earlier cli-shell experiments; do not migrate it as durable platform truth.
- [x] 3.7 Add product-extension runtime tests proving products can use resource binding, assistant seed, and attention operations without product delegation APIs.
- [x] 3.8 Add boundary comments near product-extension runtime exports stating that the package provides generic product entry points and does not own terminal write authority.
- [x] 3.9 Add TRPC/client subscription API for terminal permission requests with `terminalId` filter support.
- [x] 3.10 Add client runtime store retain/subscribe helpers for global permission notifications and terminal-scoped terminal-view consumption.
- [x] 3.11 Add client tests proving global subscribers receive all observable requests, terminal-scoped subscribers receive only matching terminal requests, unauthorized previews are not delivered, and coalesced request updates do not duplicate visible pending items.

## 4. WebUI

- [x] 4.1 Update terminal role selectors, seat labels, AvatarGroup/border role presentation, and writer downgrade prompts from requester to Guard.
- [x] 4.2 Implement global WebUI permission request subscription for WebNotification/app badge/routing without approving from notification alone.
- [x] 4.3 Ensure pending approval UI shows guard write requests, requested input, Approve/Deny actions, and Lease-until state from terminal authority.
- [x] 4.4 Update WebUI terminal detail to use terminal-scoped permission subscriptions.
- [x] 4.5 Update Storybook DOM tests for approval approve/deny/expired flows using Guard, including inline terminal-view popover behavior and duplicate-request update behavior.
- [x] 4.6 Update desktop/mobile E2E coverage for granting Guard access, creating an approval request, approving it from inline terminal UI, and writing with the resulting lease.

## 5. Terminal View Components

- [x] 5.1 Extend `@agenter/terminal-view` types with terminal permission request facts and an `onRequestPermissions` callback contract.
- [x] 5.2 Implement terminal-id scoped permission subscription wiring for `web-terminal-view`.
- [x] 5.3 Implement the default HTML-Popover TopLayer approval UI for `web-terminal-view`.
- [x] 5.4 Ensure host-provided `onRequestPermissions` can replace the default UI without replacing TerminalSystem authority.
- [x] 5.5 Add terminal-view component tests for scoped requests, custom callback handling, default popover rendering, Approve, Deny, expired status, coalesced updates, and non-cli-shell product embedding.

## 6. Cli-shell And Shell Assistant

- [x] 6.1 Update cli-shell bootstrap so shell truth terminal and visible terminal grant Shell Assistant `guard` by default.
- [x] 6.2 Refactor cli-shell managed/takeover so enable/disable only commits or settles the room-bound hosting attention item.
- [x] 6.3 Remove any cli-shell managed/takeover path that creates product write delegation, terminal write lease, permanent writer grant, or TerminalSystem-owned managed metadata.
- [x] 6.4 Ensure visible managed labels derive from the hosting attention head and remain UI projections rather than durable TerminalSystem truth.
- [x] 6.5 Update Shell Assistant prompt seed so guard approval means wait/report on the current TerminalSystem instance and does not permit equivalent `root_bash` or `workspace_bash` execution.
- [x] 6.6 Add cli-shell tests proving default guard writes create pending approval and managed enable/disable only changes hosting attention.
- [x] 6.7 Add or update a real-AI Shell Assistant validation scenario proving approval-pending, denied, and expired behavior do not fall back to root/workspace bash and managed state does not grant terminal write authority.
- [x] 6.7a Add a full real-AI cli-shell collaboration validation where the user asks Shell Assistant to operate the bound terminal, a test-side admin surrogate approves the guard request, Shell Assistant resumes through TerminalSystem, terminal-1 shows the PTY result, terminal-2 remains the product-visible surface, and the room reply is judged to understand the terminal-first workflow.
- [x] 6.8 Refactor cli-shell terminal-2 composed publication so cli-shell renders managed/unread/heartbeat/dialogue chrome into generic frame lines before publication; the published contract must not contain cli-shell-specific structured fields.
- [x] 6.9 Remove cli-shell fake store/test fixture delegation state used only to make managed/takeover appear write-authorized.
- [x] 6.10 Add short comments in cli-shell managed/takeover code stating that hosting attention is product state and terminal write authority belongs only to TerminalSystem.
- [x] 6.11 Extend `shell-terminal-view` with permission request callback support and a default OpenTUI TopLayer approval overlay.
- [x] 6.12 Add cli-shell native tests proving terminal-scoped permission requests render in TopLayer, repeated equivalent requests update one overlay, and Approve/Deny call TerminalSystem authority without mutating managed state.
- [x] 6.13 Add cli-shell cleanup command support so stale cli-shell terminals, MessageRooms, and shell-assistant sessions can be removed through product-local orchestration over generic session, message-system, and TerminalSystem APIs.

## 7. Final Verification

- [x] 7.1 Run focused terminal-system tests.
- [x] 7.2 Run focused app-server/runtime terminal tool tests.
- [x] 7.3 Run focused client-sdk subscription tests.
- [x] 7.4 Run focused terminal-view component tests.
- [x] 7.5 Run focused cli-shell tests.
- [x] 7.6 Run focused WebUI Storybook DOM or E2E tests for terminal approvals.
- [x] 7.7 Run focused product-extension-runtime tests proving delegation cleanup.
- [x] 7.8 Run `openspec validate --changes --strict` and `openspec validate --specs --strict`.
- [x] 7.9 Run cli-shell cleanup verification and local cleanup of current cli-shell resources; verify launcher startup can recreate the default shell after cleanup and dry-run reports no remaining cli-shell targets after final cleanup.

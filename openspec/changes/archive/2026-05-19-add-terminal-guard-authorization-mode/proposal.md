## Why

TerminalSystem already has the behavior users expect from a guarded writer: the actor can request a write, an admin approves it, and approval mints a timeboxed write lease. The durable name `requester` hides that law and the runtime tool surface currently turns the guarded write into a plain failure, which encourages Shell Assistant to fall back to `root_bash` or `workspace_bash` instead of staying focused on the current cli-shell terminal.

The app interaction is bigger than a role rename. A guard write creates a live permission request that users must see and act on in the surface they are using: a WebUI terminal page, an embedded `web-terminal-view`, a global WebNotification flow, or native cli-shell's `shell-terminal-view`. Those interactions determine the architecture: pending permission requests are live TerminalInstance state, subscriptions must be filterable, terminal-view components need default and customizable approval affordances, and approval must mint only TerminalSystem-native write leases.

This change makes the guarded write path a first-class authorization mode and interaction contract across TerminalSystem, runtime tools, WebUI, terminal-view components, and cli-shell.

The same work also removes a wrong abstraction introduced during cli-shell development: `ProductDelegation` tried to turn cli-shell managed/takeover into a app-level write delegation layer. That layer was never an authorized platform law. It sits between app hosting attention and TerminalSystem write leases, creating a third truth source. This change explicitly cleans it up.

## What Changes

- **BREAKING** Rename the terminal grant role `requester` to `guard` in core TerminalSystem contracts, durable specs, API/client projections, WebUI role controls, and cli-shell bootstrap defaults.
- Preserve the existing guard semantics: read access is allowed; writes do not reach the PTY without an active lease; blocked writes create approval requests when the caller asks for approval creation.
- **BREAKING** Extend terminal managed-seat authority vocabulary from `RO | RW | TM` to include `GUARD`, where `GUARD` maps to the terminal-native `guard` grant rather than direct writer authority.
- Update runtime terminal `write` and `input` tool contracts so guarded writes can create and return approval request facts to the model.
- Add a TerminalSystem permission-request subscription with filters for all terminals or a specific terminal id, so app-level notifications and terminal-scoped views can observe the same request stream without hydrating unrelated terminal state.
- Extend `web-terminal-view` with an `onRequestPermissions` callback and a default HTML-Popover TopLayer approval view.
- Extend native `shell-terminal-view` with the equivalent permission request callback and a default OpenTUI TopLayer approval view.
- Require Shell Assistant in cli-shell to treat guard approval as a pending terminal action, not as permission to run an equivalent command in `root_bash` or `workspace_bash`.
- Keep cli-shell default Shell Assistant terminal access as `guard`; cli-shell managed/takeover is app-owned hosting attention and does not create terminal authority, delegation, or write leases by itself.
- **BREAKING** Remove `ProductDelegation` / app write delegation from the current public app-extension runtime contract. Products may publish hosting attention and may request TerminalSystem authority through terminal-native grants/approval/leases, but there is no middle app-owned write-authorization truth.
- Purge cli-shell-specific managed/takeover surface fields from TerminalSystem composed terminal contracts. TerminalSystem may host a generic composed terminal frame, but it must not know labels such as `managedLabel`, `托管`, toolbar state, or cli-shell dialogue semantics.
- Update WebUI terminal surfaces to present Guard as a named role, show pending approvals, and keep approve/deny/lease state tied to terminal authority.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `terminal-collaboration-access-control`: rename `requester` to `guard` and keep guarded approval/lease semantics as the core terminal law.
- `terminal-control-plane`: add `GUARD` to managed terminal seat authority and map it to the terminal-native guard grant.
- `terminal-system-surface`: require UI tool actions to surface guard approval requests instead of treating them as generic failures.
- `webui-terminal-surface`: present Guard in terminal actor state, role controls, writer downgrade prompts, and approval UI.
- `terminal-view-component`: support terminal-scoped permission request subscriptions, `onRequestPermissions`, and a default HTML-Popover TopLayer approval view.
- `runtime-terminal-contract`: return approval request facts from runtime terminal write/input operations.
- `runtime-json-tool-descriptor-surface`: expose approval-request creation in descriptor-backed terminal write/input schemas and results.
- `runtime-skills-cli-surface`: teach AI-facing terminal CLI guidance to stop on guard approval instead of switching execution surfaces.
- `cli-shell-app`: default Shell Assistant to guard access and keep managed/takeover as attention-backed app state instead of terminal authority.
- `shell-assistant-avatar`: instruct shell-assistant to wait/report on guard approval and not route terminal work through root/workspace bash.
- `app-runtime`: keep app hosting state out of TerminalSystem authority; remove the app delegation lease contract from the current runtime surface; expose only generic app binding, assistant seed, and attention operations for this change.
- `client-runtime-store`: normalize guard role, approval requests, and lease projections without requester aliases.

## Impact

- TerminalSystem public types, database normalization/migration, control-plane authorization, approval request records, and tests.
- App-server runtime terminal handlers, descriptor schemas/help, TRPC terminal routes, and Shell Assistant prompt seed.
- TRPC/client subscriptions for terminal permission requests with `terminalId` filtering.
- Client SDK runtime store, app-extension runtime APIs, and removal of app delegation routes/store/types from the active contract.
- TerminalSystem composed surface types, app-server/TRPC/client projections, and cli-shell frame publication so composed terminal frames stay generic rather than cli-shell-specific.
- `@agenter/terminal-view` Web Component contract, WebUI terminal users dialog, role selectors, terminal surface projection, Storybook DOM tests, and E2E approval scenarios.
- cli-shell bootstrap, managed hosting attention tests, fake store fixtures, and real Shell Assistant validation scenarios.
- Existing local data containing `requester` can be migrated once or deleted/recreated; this change does not require compatibility aliases as durable truth.
- Existing local app delegation JSON data can be deleted during the breaking cleanup because it is not an authorized durable platform truth.

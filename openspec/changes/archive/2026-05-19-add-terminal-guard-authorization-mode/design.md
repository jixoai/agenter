## Context

The existing platform already has the right state machine:

- a non-direct writer can submit a write request
- TerminalSystem persists a pending approval request
- an admin approves or denies it
- approval mints a timeboxed write lease
- writes are accepted only while the grant or lease authorizes them

The problem is twofold. First, the role is named `requester`, which describes an implementation detail instead of the authorization mode. Second, the runtime-facing terminal tool path does not expose approval creation as a useful model-visible result, so a Shell Assistant sees only a failure and may use unrelated bash tools to satisfy the user request.

## Interaction First

See `interaction.md` and `interaction-prototype.html` for the app story that drives this design. The short version:

- a guarded write is a request to the current live TerminalInstance
- the user may see it inside an embedded terminal view or as a global notification
- the approval view belongs to the terminal host surface, not to cli-shell app state
- approval mints TerminalSystem-native write authority only
- terminal death or rebootstrap invalidates unresolved requests

This is why the architecture must not introduce a app delegation database or a cli-shell-specific kernel branch.

## Architecture Decision

This change is a platform-law rename plus an interaction/projection upgrade, not a new terminal authority state machine.

The terminal-native grant set becomes:

- `admin`: can administer and can write when its base write semantics allow it
- `writer`: can write directly, cannot administer others
- `guard`: can read and can request write approval, cannot write without active lease
- `readonly`: can read, cannot write or request write approval

`guard` replaces `requester` as durable truth. The implementation may include a one-time local migration from old persisted `requester` rows, but the durable API, generated types, WebUI, prompt guidance, and specs must converge on `guard`.

## Layering

TerminalSystem owns the authority law. It should not know about cli-shell or Shell Assistant.

Runtime terminal tools expose the authority result. They may request approval creation and return approval request facts, but they do not decide cli-shell behavior.

cli-shell owns the app interpretation. In cli-shell, the current MessageRoom is about the current TerminalSystem instance, so a guard approval result means "the terminal action is pending admin approval" rather than "try a different shell".

WebUI owns operator affordances. It presents Guard as a role, shows pending approvals, and allows admins to approve/deny without reconstructing terminal truth locally.

Terminal-view components own inline permission affordances. They subscribe to permission requests for the terminal they render, expose a callback for host customization, and provide a default TopLayer approval UI. They do not own authorization.

App-extension runtime owns only generic app entry points: descriptor resolution, resource binding, assistant seed, and attention operations. It must not define a app write-delegation authority layer for cli-shell. If a future app needs a reusable delegation primitive, that must be designed as a separate platform capability with a non-cli-shell use case and an explicit authority owner.

## Permission Request State

Pending permission requests are live TerminalInstance state. They are meaningful only while the terminal instance that rejected the write is still alive. The system may keep durable activity/history rows for audit and UI history, but unresolved requests must not be restored as executable authority after terminal kill/rebootstrap.

TerminalSystem should expose a live permission request stream:

- `filter: all` for global WebNotification, app-level badges, and command centers
- `filter: { terminalId }` for `web-terminal-view`, terminal detail pages, and cli-shell native host views

Filtering must happen at the TerminalSystem/API boundary, not only in the client store. A caller with a global subscription receives all observable requests for its authority scope. A terminal-scoped subscriber receives only requests for that terminal, and only if the caller can observe that terminal. UI code may still perform presentation filtering, but it must not become the security boundary.

The event payload should include enough UI facts to render without a full terminal catalog hydrate:

- terminal id and display title when known
- request id
- requesting actor id/label
- requested input mode and preview
- created/expires timestamps
- current status

Approve/deny remains a separate TerminalSystem command. The subscription is observation, not authority.

Pending request identity should be explicit enough to avoid duplicate approval spam. While an equivalent request is still pending for the same live TerminalInstance, actor, input mode, and requested input, the control plane should reuse or refresh the open request instead of emitting an unbounded series of new approval prompts. A changed requested input is a different request.

Deny and expiry are terminal decisions. They leave the PTY unchanged, close or expire the pending request, and do not authorize the model to perform the same visible terminal action through another execution surface. Runtime tool results and prompt guidance must preserve that distinction.

## Terminal View Contract

`web-terminal-view` needs a app-agnostic permission surface:

- property/callback: `onRequestPermissions(request)`
- default behavior: render an HTML-Popover approval view in TopLayer
- host override: if the callback handles the request, the component does not render the default view
- scoped subscription: subscribe only to requests for the rendered terminal id
- authority rule: custom UI can only call TerminalSystem approve/deny commands; it cannot mint leases locally or mark requests resolved as app state

`shell-terminal-view` needs the same conceptual contract for OpenTUI:

- callback for app-level customization
- default OpenTUI TopLayer overlay
- no mutation of terminal scrollback, selection truth, shell truth, or cli-shell managed state

This mirrors the same app story across Web and native hosts without making TerminalSystem aware of either host's UI implementation.

The contract must stay useful for non-cli-shell products. A app that embeds a terminal view without hosting/managed concepts should receive guard approval UI and callbacks, but no cli-shell labels, app delegation semantics, or managed-state assumptions.

## Data And Migration

This is intentionally breaking. Existing `requester` data is not a long-term compatibility surface.

Implementation may choose one of two one-time local strategies:

- migrate existing terminal grant rows, approval projections, tests, and fixtures from `requester` to `guard`
- delete local incompatible cli-shell/terminal test data and let bootstrap recreate it

After the implementation lands, `requester` must not remain in public types, specs, user-facing WebUI labels, prompt seed text, generated runtime skill text, or canonical tests.

Existing `ProductDelegation` JSON data and fixtures are not durable platform truth. They may be deleted during this breaking cleanup. The replacement facts are:

- cli-shell managed/takeover state: app-owned hosting attention
- terminal write authority: TerminalSystem grants, guard approval requests, and terminal-native write leases
- visible managed/takeover label: a cli-shell-rendered projection of hosting attention, not a TerminalSystem metadata fact

Unresolved approval request data from an old TerminalInstance is also not long-term executable truth. If local data cleanup is needed, prefer clearing stale pending approval requests over replaying them into a new terminal instance.

## Runtime Tool Result Law

For `terminal write` and `terminal input`, a guard actor without an active write lease should produce a structured result:

- `ok: false`
- a message explaining that approval is required
- `approvalRequest` when an approval request was created

That result is progress, not a generic terminal failure. The AI-visible guidance must tell the model to report/wait for approval or ask the admin, not to run the same command somewhere else.

## Cli-shell Law

Default cli-shell Shell Assistant access is Guard. This preserves user control for ordinary pair-programming sessions.

Managed/takeover is cli-shell application state, not TerminalSystem authority. Enabling it commits or updates the room-bound hosting attention item for the current shell. Disabling it commits or settles that hosting attention item. These commits are the only durable state transition for managed mode.

Managed/takeover MUST NOT create terminal-native write leases, app write delegations, permanent writer grants, or TerminalSystem metadata that becomes a second source of truth. If Shell Assistant later needs to write to the terminal while hosting is active, it uses the ordinary terminal API under its existing terminal authority. A Guard actor still enters the guard approval path; a Writer actor can write directly; hosting attention does not change either rule.

Any visible label such as "托管 on" is a projection of the hosting attention head. It may be cached in a rendered frame, but it is not durable truth and cannot be used to authorize terminal writes.

`ProductDelegation` is removed from this cli-shell law. The model was a mistaken middle layer: it named app-specific hosting work as if it were reusable platform authorization, then tried to mirror that into terminal write leases. That violates the app/core boundary because future products would inherit cli-shell's managed/takeover semantics without opting into them.

## Composed Terminal Surface Law

TerminalSystem may provide a generic composed terminal runtime: an authorized publisher can publish a terminal frame that already contains the app's accepted visible screen. TerminalSystem's job is to store, publish, read, and transport that frame as terminal truth.

TerminalSystem must not model cli-shell chrome. It must not expose fields named after cli-shell state such as `managedLabel`, toolbar state, heartbeat text, dialogue draft, or Chinese labels like "托管 off". Those belong to cli-shell's renderer before the frame crosses the TerminalSystem boundary.

The boundary should look like this:

```text
cli-shell app state
  hosting attention, room unread projection, dialogue draft, toolbar layout
        |
        v
cli-shell renderer builds complete terminal frame
        |
        v
TerminalSystem composed runtime stores/transports generic frame
```

This keeps terminal composition reusable: another app can publish a composed frame without inheriting cli-shell managed/takeover vocabulary.

## Boundary Comments And Regression Guards

The implementation must leave short code comments at app/core boundary points. The comments should not narrate trivial code. They should state the durable rule:

- cli-shell managed/takeover is app attention state, not TerminalSystem authority
- TerminalSystem composed surface accepts generic terminal frames, not cli-shell chrome semantics
- app-extension runtime must not create app-owned write authority for terminal work
- terminal-view permission UI observes TerminalSystem requests and must not approve without an explicit user/admin action

Tests must enforce the same rule by searching core surfaces for cli-shell-specific tokens or by asserting the absence of app delegation routes/types where appropriate.

The cli-shell-specific prompt rule stays app-local:

- MessageRoom conversation defaults to the bound TerminalSystem instance.
- Terminal actions go through terminal APIs.
- Guard approval means wait/report on that terminal approval.
- Hosting/managed means there is an active cli-shell attention obligation, not that terminal permissions changed.
- Root/workspace bash stays an entry environment for runtime-local CLI commands or explicit workspace/file work, not a substitute for visible terminal operation.

## Risks

- Broad rename churn: TypeScript types, tests, fixtures, generated skill text, WebUI labels, and stored data all mention `requester`.
- Old data may fail until migrated or cleaned. This is acceptable for this breaking change.
- If runtime tools expose approval creation without prompt/tool guidance, the model may still treat it as failure. The implementation must update both result shape and Shell Assistant guidance.
- If WebUI only renames labels without changing tests, old requester semantics can leak back through fixtures and role selectors.
- If `ProductDelegation` is merely left unused, future work can accidentally revive it as a second authority truth. Prefer removal over deprecation unless a separate approved change redesigns delegation as a generic platform capability.
- If TerminalSystem keeps app-named composed fields, future products will inherit cli-shell UI semantics. The composed contract must be frame-oriented or otherwise app-opaque.
- If approval subscriptions are only global, terminal-view components will either over-hydrate or miss inline requests. The subscription must support terminal-id filtering.
- If permission requests are stored as durable restartable authority, a killed/rebootstrapped terminal can inherit stale approval state. Pending request authority must stay TerminalInstance-bound.
- If duplicate guard writes create a new prompt every loop tick, users will see approval spam and may approve the wrong request. Equivalent pending request coalescing belongs in TerminalSystem, not the UI.
- If deny/expiry is treated as a generic tool failure, the model may fall back to root/workspace bash and violate the visible-terminal contract. Runtime results and prompt text must name deny/expiry as terminal-local authorization outcomes.
- If client-side filtering is treated as access control, global subscribers can over-receive sensitive request previews. Server-side subscription filtering and visibility checks are required.

## Non-Goals

- Do not add a second core role that duplicates guard/requester behavior.
- Do not make cli-shell behavior a global runtime rule.
- Do not couple cli-shell managed/takeover to TerminalSystem authority, app write delegation, or terminal write leases.
- Do not preserve `ProductDelegation` as a current public contract for cli-shell managed/takeover.
- Do not let TerminalSystem define cli-shell UI vocabulary in composed surface types or metadata defaults.
- Do not implement long-term requester compatibility aliases as durable public truth.

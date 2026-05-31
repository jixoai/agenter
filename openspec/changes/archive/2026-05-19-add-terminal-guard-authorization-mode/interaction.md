# Guard Authorization Interaction Story

## Why This Exists

This change is interaction-sensitive. If the interaction is vague, the architecture drifts into the wrong shape: persistent app delegation, WebUI-only permission screens, or cli-shell-specific kernel rules. The app story is the source of the architecture.

## Story 1: Web Terminal Inline Approval

The user is looking at one terminal in WebUI. Shell Assistant tries to type into that same terminal, but its terminal role is `guard`. The terminal does not write to the PTY. Instead, the live TerminalInstance creates an in-memory pending permission request tied to that terminal instance.

The embedded `web-terminal-view` receives the request through a filtered subscription for its terminal id. It calls `onRequestPermissions(request)` if the host provided one. If no callback is provided, it renders the default authorization view in TopLayer with HTML Popover:

- requested actor
- requested input preview
- terminal title/id
- expires-at countdown
- Approve
- Deny

The terminal remains visible behind the popover. Approve mints a TerminalSystem write lease for that actor and request. Deny closes the request and leaves the PTY unchanged.

```text
WebUI terminal detail
┌────────────────────────────────────────────┐
│ terminal toolbar                           │
├────────────────────────────────────────────┤
│                                            │
│  <web-terminal-view terminalId="T1">       │
│  $ pnpm test                               │
│  ...                                       │
│                                            │
│       ┌─ popover / TopLayer ───────────┐   │
│       │ Shell Assistant requests write │   │
│       │ echo "hello" + Enter           │   │
│       │ [Deny]              [Approve]  │   │
│       └────────────────────────────────┘   │
│                                            │
└────────────────────────────────────────────┘
```

## Story 2: Global Web Notification

The user is not looking at that terminal. A guarded write request appears. The app has a global subscription with no terminal filter, used by WebNotification and app-level badges.

The global subscriber receives the same request event, shows a notification, and can route the user to the terminal detail page. It does not approve silently. It does not need to hydrate every terminal.

```text
terminalPermissionRequests(filter: all)
        |
        +--> WebNotification "Terminal T1 needs approval"
        +--> app badge / command center
        +--> route to /terminals/T1
```

## Story 3: Native cli-shell TopLayer Approval

The user is inside cli-shell native mode. The visible surface is `shell-terminal-view`, backed by OpenTUI. Shell Assistant tries a guarded terminal write. The same TerminalInstance request appears through a terminal-id filtered subscription.

`shell-terminal-view` has the same conceptual contract as `web-terminal-view`: it can call `onRequestPermissions` for app customization, otherwise it renders a default OpenTUI TopLayer overlay. The overlay is nested above the terminal renderable and does not mutate shell scrollback or app-managed state.

```text
cli-shell native host
┌────────────────────────────────────────────┐
│ $ cargo run                                │
│ ...                                        │
│                                            │
│       ╭─ permission request ─────────╮     │
│       │ Shell Assistant wants input  │     │
│       │ <key name="Enter"/>          │     │
│       │ [Deny]          [Approve]    │     │
│       ╰──────────────────────────────╯     │
│                                            │
│ managed on | heartbeat | chat              │
└────────────────────────────────────────────┘
```

## Story 4: Terminal Death Or Rebootstrap

The pending request is bound to the live TerminalInstance. If the terminal process dies, the request is gone. If the terminal is killed and bootstrapped into a new live instance, old approval requests do not apply to the new instance.

Durable activity history may record that a request existed and how it resolved, but unresolved permission state is not restored as executable authority after instance replacement.

## Story 5: Deny, Expiry, And Repeated Attempts

The user denies a request, or the request expires before any admin answers. That decision means the requested input still did not happen in the terminal. Shell Assistant may report the result and ask what to do next, but it must not perform the same visible terminal action through `root_bash` or `workspace_bash` and pretend the current terminal changed.

If the same actor retries the same pending terminal input while an equivalent request is still open, the system should avoid notification spam. The control plane can reuse or update the existing pending request for that actor, terminal instance, input mode, and requested input preview. A materially different input creates a different request.

```text
guard write: echo "ship" + Enter
        |
        v
pending request R1
        |
        +--> retry same input before decision: R1 is reused/refreshed
        +--> retry different input: create R2
        +--> deny/expire: no PTY write, no fallback shell execution
```

## Story 6: Another App Embeds Terminal View

A future app embeds `web-terminal-view` or `shell-terminal-view` without any cli-shell managed/takeover concept. It should still get the same guard approval affordance because the component observes TerminalSystem permission facts. It should not inherit cli-shell hosting labels, managed state, or app delegation behavior.

This confirms the ownership split: terminal-view owns a reusable UI affordance, TerminalSystem owns authorization, and cli-shell owns only cli-shell app interpretation.

## App Rules

- Permission requests are terminal-instance state, not cli-shell state.
- Permission requests are not app delegation.
- Approval creates terminal-native write authority only for the approved actor/request.
- Deny and expiry leave the PTY unchanged and do not authorize fallback execution in another shell.
- `terminal-view` components provide the interaction affordance, not the authority.
- Global subscribers observe only requests the subscriber is authorized to see; terminal-view subscribers receive server-filtered events for one terminal id.
- Default views exist, but host products can replace them through callbacks without replacing TerminalSystem approval authority.
- Repeated equivalent pending requests should be deduplicated or refreshed to avoid notification spam.

## Architecture Derived From The Story

- TerminalSystem exposes a subscription for permission request events with an optional `terminalId` filter.
- The subscription is live, access-controlled, and TerminalInstance-bound. It is not a new app database.
- TerminalSystem owns equivalence and lifecycle rules for pending requests; UI clients do not deduplicate by inventing local authority state.
- Client SDK exposes both:
  - global retain/subscribe path for app notifications
  - terminal-scoped subscribe path for terminal-view components
- `web-terminal-view` accepts an `onRequestPermissions` callback and has a built-in HTML-Popover TopLayer fallback.
- `shell-terminal-view` accepts the same conceptual callback and has a built-in OpenTUI TopLayer fallback.
- WebUI terminal users/admin panels can still list historical approval requests when useful, but the immediate permission UX is driven by live subscription events.

> Boundary note:
> This design remains relevant for Avatar selection/create/clear semantics and for the general rule that terminal approvals stay terminal-local.
> But any cli-shell terminal-identity or browser-host wording must now be read through `realign-cli-shell-with-core-system-boundaries`: cli-shell uses one bound TerminalSystem terminal as shell truth, and browser-host experiments are not the current cli-shell product route.

## Physical Review

The current platform law is correct and must stay intact:

- AvatarRuntime identity is the Avatar identity, not `--session`.
- cli-shell is an ordinary product package and must consume platform capabilities through generic contracts.
- `--session=4` means product resource key `shell-4`; it does not create a clean Avatar context.
- cli-shell may have implementation-local host structure under one product session, but product interaction is anchored on the bound TerminalSystem terminal.
- TerminalSystem owns write authority. Guard approval is terminal authority, not cli-shell managed/takeover state.

The current implementation is incomplete in three places:

- Main checkout parses positional `@avatar`, but not `--avatar`, `--create-avatar`, or `--clear-avatar`.
- Missing explicit Avatars fail unless the Avatar is the default `shell-assistant`.
- The live authorization popup is not proven by component tests alone. If the popup is missing in cli-shell, the first suspicion is that Shell Assistant's write request did not target the currently opened terminal or that the current-terminal permission stream is not connected in the real product path.

## Product Story

A user wants to run:

```bash
agenter shell --session=4 --avatar=review-4 --create-avatar --clear-avatar
```

The expected story is:

1. cli-shell resolves `review-4` as the selected Avatar.
2. If `review-4` does not exist, cli-shell creates it through the generic global Avatar API.
3. If `--clear-avatar` is present, cli-shell deletes the selected Avatar's current runtime session for this workspace before creating or starting the replacement runtime.
4. The Avatar's canonical assets stay in place. `AGENTER.mdx`, memory files, profile media, and principal identity are not deleted by a runtime clear.
5. The created Avatar is an ordinary Avatar. cli-shell does not add a special prompt, memory pack, classify value, or hidden mode.
6. The user sees one cli-shell surface. If Shell Assistant tries to write to the bound terminal and TerminalSystem requires guard approval, the approval request appears on that same surface.
7. Approve/Deny acts on the real TerminalSystem request id and terminal id. The UI does not mint leases locally and does not mutate managed/takeover state.

## Flag Semantics

`--avatar=<nickname>` is the only selector flag. Positional `@nickname` may remain as an existing shorthand, but if both are present and differ, startup must fail.

`--create-avatar` is a boolean creation permission. Without it, selecting a missing Avatar fails clearly. With it, cli-shell creates the Avatar through the generic Avatar catalog API.

`--clear-avatar` is a boolean runtime-session reset. It must run after Avatar resolution and before `ensureRuntime/startRuntime`.

`--test-avatar` is not part of the contract. It made selection and creation ambiguous by mixing two decisions into one flag, and this system must not model a separate Avatar kind for this workflow.

## Clear Semantics

The recommended clear scope is:

- delete the selected Avatar's current runtime session for the current workspace, if it exists
- stop/abort its live runtime before deletion through the existing session delete path
- remove session-local model-call history, prompt-window history, runtime cycle state, and runtime-local session artifacts
- preserve the global Avatar principal, nickname alias, canonical Avatar root, `AGENTER.mdx`, memory files, profile media, and workspace files

This keeps startup fast and clean without turning `--clear-avatar` into a dangerous avatar deletion command.

Product terminal and MessageRoom resources are not deleted by this flag by default. Those are product resource cleanup concerns and already belong to `agenter shell cleanup`. A user who wants a fully empty terminal/room should either use a new `--session` name or run cleanup for that product resource.

## Prompt And Memory Boundary

`--create-avatar` creates an ordinary Avatar. It must not create a separate Avatar concept or install a special prompt/memory pack for this startup flow.

Therefore:

- default `shell-assistant` keeps the existing seed-if-missing prompt and memory pack behavior
- explicit `--avatar=<name>` keeps the selected Avatar's own prompt and memory truth
- product-created `--avatar=<name> --create-avatar` uses the ordinary Avatar creation path
- cli-shell must not install a special prompt or memory pack only because an Avatar was created through this command
- `--clear-avatar` clears runtime session context only and must not delete or rewrite prompt/memory assets

The canonical prompt path remains:

```text
[~|<workspace>]/.agenter/avatars/by-principal/<principalId>/AGENTER.mdx
```

Nickname aliases are discovery paths only.

## Authorization Popup Gap

The guard authorization popup is not complete just because `shell-terminal-view` and `web-terminal-view` have component tests. The product law is simpler than my earlier overreach:

- cli-shell binds one TerminalSystem terminal for the user-facing conversation.
- cli-shell subscribes to permission requests for that bound terminal.
- Shell Assistant terminal writes for that room must target that same bound terminal.
- If a permission request is created on a hidden/internal terminal instead, that is a target-resolution or binding bug.

The fix must not widen subscriptions to a role set as a workaround. A wider subscription would hide the real bug and make terminal-view less orthogonal. The correct implementation path is:

- identify the bound terminal id as a first-class cli-shell product fact
- subscribe only to that terminal's permission request stream
- ensure runtime-local `terminal write` / `terminal input` guidance and resource focus resolve to that terminal for cli-shell MessageRoom work
- render the default approval overlay for requests on that terminal
- preserve TerminalSystem authority: no UI marks a request approved locally; it calls TerminalSystem approve/deny

## Product UI Details

The native cli-shell host surface must validate this behavior. WebUI is a separate product and is intentionally out of scope for this change. Browser-host experiments do not define the current cli-shell product route.

Native cli-shell:

- default OpenTUI TopLayer approval overlay must appear over the visible shell surface
- overlay must be driven by the bound terminal's permission stream
- Approve and Deny must call TerminalSystem authority with the request's original terminal id
- overlay must not mutate managed/takeover state
- repeated equivalent requests update one overlay instead of stacking

## Options Considered

Option A, recommended: product-scoped startup flags plus current-bound-terminal authorization projection.

This keeps `--session` product-local, keeps AvatarRuntime identity pure, and makes terminal-view components reusable. cli-shell owns the mapping from product session to the bound terminal; TerminalSystem owns request authority; terminal-view owns projection for that terminal.

Option B, rejected: make `--session` part of runtime identity or create a cli-shell-specific core branch.

This would make test setup look easy but corrupt the runtime topology. Future products would inherit cli-shell naming and cleanup semantics.

Option C, rejected: subscribe cli-shell to a whole terminal role set to make missing popups appear.

This hides the important bug: the model or runtime wrote to the wrong terminal. It also weakens the terminal-view contract by making a terminal viewport show requests for terminals it did not open.

Option D, rejected: make WebUI or a browser-host experiment carry cli-shell-specific launch or approval behavior.

WebUI and cli-shell are independent products. WebUI may have its own terminal approval surface, but this change must not add WebUI affordances that exist only to launch, configure, or patch cli-shell.

## Open Questions

- Should there be a future explicit flag that also deletes the current cli-shell MessageRoom and terminal pair, separate from `--clear-avatar`?

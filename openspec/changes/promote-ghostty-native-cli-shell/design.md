## Context

`add-cli-shell-product` established cli-shell as an external product package that binds one shell-terminal to one backend terminal, one room, and one AvatarRuntime through product-extension contracts. That law is still correct, but two concrete contracts are now wrong for the next platform step.

First, cli-shell has no explicit backend-selection path. The current argv only carries avatar and session naming, `ProductEnsureTerminalBindingInput.createInput` has no backend field, terminal control-plane durable launch truth does not expose a backend field, and `@agenter/termless-core` only instantiates the official xterm backend. The durable specs already separate backend truth from browser renderer truth, so the implementation gap is platform plumbing, not a product-local shortcut.

Second, cli-shell still models `bottom` as a multi-row transcript panel. The user has now tightened the product law: the shell-terminal bottom surface may render exactly one row, and bottom content must be derived by rendering markdown at constrained width and taking only the last rendered line. That means bottom is a projection surface, not a second transcript panel.

This change stays scoped to cli-shell and terminal backend/runtime law. It MUST NOT pull `extend-attention-cli-self-evolution-runtime` into the same implementation.

## Goals / Non-Goals

**Goals:**

- Provide a real product path for `bun agenter shell --backend=ghostty-native`.
- Keep backend identity as durable terminal launch truth rather than a renderer alias or product-local flag.
- Reuse the official Termless ownership slot for `ghostty-native` without introducing another Agenter-private backend package.
- Keep xterm as the default backend unless the user explicitly asks for another backend.
- Redefine cli-shell bottom rendering as a one-line markdown projection built from `MarkdownRenderable`.
- Preserve the core/product boundary: cli-shell consumes contracts, core runtime stays product-agnostic.

**Non-Goals:**

- Do not promote `ghostty-native` to the global default backend.
- Do not collapse backend selection into `rendererPreference` or `resolvedRenderer`.
- Do not implement `extend-attention-cli-self-evolution-runtime`.
- Do not keep a multi-row bottom transcript panel behind compatibility flags.
- Do not add cli-shell-specific logic to core launcher/runtime modules.

## Decisions

### 1. Backend selection becomes explicit durable launch truth named `backend`

Cli-shell will parse `--backend=<name>` and pass that value as explicit terminal launch truth named `backend`. The terminal control-plane, runtime terminal config surfaces, and product terminal-binding contract will all use the same field name.

Rationale:

- The user-facing grammar is already `--backend=ghostty-native`, so the durable field should not invent another alias.
- `backend` is launch truth. It names the backend instance family used by terminal-system and Termless, not the browser renderer used by terminal-view.
- The current durable specs already distinguish launch truth from renderer truth, so the correct move is to expose the missing launch field rather than reuse presentation fields.

Alternatives considered:

- Reuse `rendererPreference`.
  - Rejected because renderer is a viewport concern and may legitimately stay `xterm` while the backend becomes `ghostty-native`.
- Hide backend selection inside `processKind`.
  - Rejected because process kind is about command/runtime profile semantics, not backend ownership.

### 2. Existing terminals follow a backend-aware reuse policy

Cli-shell will keep binding one shell name to one durable terminal id, but backend mismatch handling must be explicit:

- If the terminal does not exist, create it with the requested backend.
- If the terminal exists and is `not_started` or `stopped`, update durable backend launch truth before bootstrap when the requested backend differs.
- If the terminal exists and is already running with a different backend, cli-shell fails with a clear backend-mismatch error instead of silently attaching, silently falling back, or mutating live backend identity in place.

Rationale:

- Backend identity is part of launch truth. Silent mismatch reuse would make `--backend=ghostty-native` observationally false.
- Live backend swaps are more disruptive than geometry or title updates and should not be smuggled through an attach path.

Alternatives considered:

- Always attach to the existing running terminal regardless of backend mismatch.
  - Rejected because the argv contract would become misleading.
- Force-stop and recreate the running terminal during attach.
  - Rejected because attach should not destroy or restart a running terminal without an explicit lifecycle action.

### 3. Official Termless packages remain the only backend ownership layer

`@agenter/termless-core` will grow a backend factory/adapter layer that selects between official backend packages such as `@termless/xtermjs` and `@termless/ghostty-native`. Agenter-local code may wrap those backends behind bridge contracts, but backend identity stays owned by official Termless packages.

Rationale:

- This preserves the architecture already established by `termless-backend-adoption`.
- It keeps backend adoption orthogonal to renderer adoption and avoids reintroducing Agenter-private backend authority.

Alternatives considered:

- Publish or restore an Agenter-private `ghostty-native` backend package.
  - Rejected because it recreates a second backend ownership layer.

### 4. Bottom becomes a projection surface, not a transcript panel

Cli-shell will keep the shell-terminal bottom surface at exactly one row. Any bottom-rendered content, including Heartbeat text or a bottom dialogue preview, must be produced by rendering markdown with OpenTUI `MarkdownRenderable` at the constrained row width and then selecting only the last rendered line.

The multi-row bottom dialogue panel contract is removed. Explicit transcript chrome remains side or floating chrome. A `bottom` placement request becomes projection-only mode rather than a docked transcript pane.

Rationale:

- This matches the user's tightened product law exactly.
- It preserves terminal primacy and avoids consuming terminal rows with a second bottom panel.
- A markdown-to-last-line projection gives one consistent rendering path for rich Heartbeat content without letting bottom UI grow vertically.

Alternatives considered:

- Keep the old multi-row bottom panel and only clamp its initial height.
  - Rejected because the law is now “bottom only one line”, not “bottom usually small”.
- Bypass markdown rendering and hand-roll last-line string truncation.
  - Rejected because the required projection must come from the same markdown renderer semantics used by the product.

### 5. Transcript input remains explicit and separate from the collapsed bottom row

The collapsed bottom row is display-only. Transcript composition continues to live behind explicit chat focus or explicit transcript chrome, not in the always-visible bottom projection row.

Rationale:

- A single-row projection cannot simultaneously remain terminal-first, display rich status, and host an unconstrained multiline input surface.
- Keeping input explicit preserves the existing terminal input ownership law.

## Risks / Trade-offs

- `[Ghostty-native dependency or platform availability differs from xterm]` -> Keep xterm as the default backend, fail clearly on explicit `ghostty-native` requests, and validate with a real local walkthrough before claiming support.
- `[Existing durable terminals may already exist with xterm launch truth]` -> Use explicit reuse policy: update stopped terminals, reject running mismatches, and keep error messages precise.
- `[Last-line markdown projection loses context from richer Heartbeat content]` -> Keep explicit side/floating transcript chrome available for full context while reserving the bottom row for compact projection only.
- `[Removing bottom multi-row transcript behavior may break current tests and muscle memory]` -> Update OpenSpec tasks, acceptance tests, and TUI contracts in the same change instead of keeping a compatibility branch.

## Migration Plan

1. Land the spec change first.
2. Add `backend` durable launch truth through terminal-system, runtime/client surfaces, and product-extension runtime.
3. Add official `ghostty-native` backend instantiation behind the shared Termless ownership slot.
4. Wire cli-shell argv/bootstrap/reuse policy to the new backend contract.
5. Replace bottom multi-row rendering with the single-line markdown projection helper and remove bottom transcript-panel behavior.
6. Verify with targeted tests and a real `bun agenter shell --backend=ghostty-native` walkthrough, including actual terminal input/output.

Rollback:

- Revert the implementation commit(s) for this change, restoring xterm-only cli-shell behavior and the prior bottom-panel contract.
- Because default backend stays xterm, rollback does not require a durable migration for terminals that were never explicitly switched.

## Open Questions

- No contract-level open questions remain for the spec phase. If `@termless/ghostty-native` exposes packaging or host-environment constraints during implementation, that should be recorded as implementation evidence, not kept as a spec ambiguity.

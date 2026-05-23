## Why

Recent cli-shell work over-corrected a real core/product coupling bug. The old `terminal-1` / `terminal-2` compositor wrongly made TerminalSystem carry cli-shell product chrome, but the tmux migration then wrongly treated tmux as cli-shell's Shell truth. Both directions violate the same boundary: Shell/TerminalSystem, Avatar prompt/Core, terminal authorization/TerminalSystem, and Room/MessageSystem are kernel facts; cli-shell is only a TUI product that renders and operates those facts through generic SDK contracts.

This change stops implementation work and writes the corrective contract before more code is added. The desired architecture is not "tmux replaces TerminalSystem" and not "restore terminal-2"; it is "cli-shell consumes core systems through a well-designed product SDK and presents them in a TUI."

## What Changes

- Reframe cli-shell as a TUI projection/input product over core systems, not as a Shell owner. **BREAKING**
- Replace the current "tmux-hosted visible terminal surface" law with a generic SDK law: TerminalSystem remains Shell truth, MessageSystem remains Room truth, Avatar/Core remains prompt truth, and TerminalSystem remains authorization truth. **BREAKING**
- Add a product-system SDK boundary capability that defines the legal surfaces for product TUI development: terminal projection/input/approval, room snapshot/send, avatar runtime/session-fact observation, attention projection/commit, and product lifecycle cleanup.
- Require cli-shell to bind a TerminalSystem terminal resource for the current shell session through generic product resource binding rather than fabricating extension-local terminal truth.
- Allow tmux/OpenTUI only as local presentation containers, focus/layout hosts, or process shells; they must not become durable terminal truth, authorization truth, prompt truth, or MessageRoom truth.
- Clarify that `AGENTER.mdx` remains the single trusted prompt source, while current cli-shell binding facts are exposed as runtime/session facts rather than a second hidden prompt source.
- Require product-selected Avatar context to describe the current product binding without hard-coding cli-shell into core prompts or rewriting user prompt files.
- Require client-sdk/runtime-store to expose the missing typed product facades instead of forcing cli-shell to reach for TerminalSystem internals, stale `terminal list`, or product-local tmux state as a substitute.
- Mark the architectural claims in `move-cli-shell-to-extension-tmux-host` and `refine-cli-shell-tmux-product-shell` as superseded by this change, while retaining their valid package-move and interaction-story inputs as reference material.
- Keep the extension package move itself valid: `extensions/cli-shell` remains the right ownership location; only the tmux-as-Shell-body model is rejected.
- Keep managed/takeover as product-scoped attention, not a TerminalSystem mode and not a tmux boolean.
- Keep cleanup as a product lifecycle action over SDK-bound resources; cleanup may remove stale historical residue but runtime correctness must not depend on residue removal.

## Capabilities

### New Capabilities
- `product-system-sdk-boundary`: Generic law for product TUIs consuming TerminalSystem, MessageSystem, Avatar/Core, and Attention through SDK contracts without owning those systems.

### Modified Capabilities
- `cli-shell-product`: Replace terminal-2 and tmux-Shell laws with a core-system TUI projection law.
- `product-extension-runtime`: Clarify product resource binding and product context APIs must expose core-system resources without product-specific core branches or product-owned Shell truth.
- `runtime-terminal-contract`: Require runtime/client publications to support product TUIs that need terminal projection/input/approval over TerminalSystem truth.
- `terminal-control-plane`: Clarify terminal write/read/await/approval remain the canonical shell operation and authorization surface for product TUIs.
- `terminal-screen-projection-law`: Remove cli-shell-specific `terminal-2` product truth assumptions and keep only the generic projection law.
- `terminal-view-component`: Remove cli-shell-specific `terminal-2` references and keep the component family generic.
- `shell-assistant-avatar`: Reframe cli-shell prompt guidance as product-context guidance over TerminalSystem truth, and ensure explicit Avatar selections can receive product context without becoming special test Avatars.
- `client-runtime-store`: Add typed product-facing facades for terminal, room, attention, and runtime projections needed by cli-shell-like TUIs.

## Impact

- OpenSpec truth:
  - `openspec/specs/cli-shell-product/spec.md`
  - `openspec/specs/product-extension-runtime/spec.md`
  - `openspec/specs/runtime-terminal-contract/spec.md`
  - `openspec/specs/terminal-control-plane/spec.md`
  - `openspec/specs/terminal-screen-projection-law/spec.md`
  - `openspec/specs/terminal-view-component/spec.md`
  - `openspec/specs/shell-assistant-avatar/spec.md`
  - `openspec/specs/client-runtime-store/spec.md`
  - `extensions/cli-shell/SPEC.md`
- Active changes that must be revised before implementation:
  - `openspec/changes/move-cli-shell-to-extension-tmux-host`
  - `openspec/changes/refine-cli-shell-tmux-product-shell`
  - see `openspec/changes/realign-cli-shell-with-core-system-boundaries/boundary-audit.md` for the exact keep/rewrite/delete disposition
- Likely implementation areas after this change is accepted:
  - `packages/client-sdk/src/runtime-store.ts`
  - `packages/client-sdk/src/product-extension-runtime.ts`
  - `packages/product-extension-runtime/src/*`
  - `packages/app-server/src/trpc/router.ts`
  - `packages/app-server/src/runtime-shell-bin.ts`
  - `extensions/cli-shell/src/bootstrap.ts`
  - `extensions/cli-shell/src/tmux-host.ts`
  - `extensions/cli-shell/src/tui/*`
  - `extensions/cli-shell/test/*`

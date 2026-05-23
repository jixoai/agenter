## 1. Boundary Review And Spec Rewrite

- [x] 1.1 Rewrite `openspec/specs/cli-shell-product/spec.md` to remove both legacy `terminal-1/terminal-2` product chrome law and tmux-as-Shell truth law.
- [x] 1.2 Update `extensions/cli-shell/SPEC.md` so it says cli-shell is a TUI over TerminalSystem, MessageSystem, AvatarRuntime/Core, and AttentionSystem.
- [x] 1.2.1 Rewrite `openspec/specs/terminal-screen-projection-law/spec.md` to remove cli-shell-specific `terminal-2` product truth assumptions.
- [x] 1.2.2 Rewrite `openspec/specs/terminal-view-component/spec.md` to remove cli-shell-specific `terminal-2` wording and keep the component family generic.
- [x] 1.3 Rewrite or supersede `move-cli-shell-to-extension-tmux-host` so the extension package move remains, but TerminalSystem remains the Shell owner.
- [x] 1.4 Rewrite or supersede `refine-cli-shell-tmux-product-shell` so tmux/OpenTUI are local presentation hosts, not durable Shell truth.
- [x] 1.5 Add a boundary audit document listing existing code/spec conflicts and the intended disposition for each.
- [x] 1.6 Rewrite any remaining wording that implies cli-shell runtime facts are a second prompt source; `AGENTER.mdx` must remain the single trusted prompt source.
- [x] 1.6.1 Add superseded/boundary notes to the still-active historical cli-shell changes so future work does not resume old `terminal-1/terminal-2` ontology by mistake.
- [x] 1.6.2 Update entry documentation such as `extensions/cli-shell/README.md` so it no longer implies TerminalSystem is absent from active cli-shell shell targeting.
- [x] 1.6.3 Add superseded notes to historical delta specs such as `add-cli-shell-web-host/specs/*` so direct spec-file entry also carries the new boundary warning.
- [x] 1.6.4 Add superseded notes to larger historical delta-spec sets such as `separate-cli-shell-product-from-terminal-view-components/specs/*` so direct spec-file entry cannot bypass the new boundary warning.
- [x] 1.6.5 Re-audit `complete-cli-shell-avatar-session-reset` and rewrite or annotate any remaining old terminal-identity, `--web`, or `packages/cli-shell` wording.
- [x] 1.6.6 Rewrite durable `openspec/specs/product-command-launcher/spec.md` path facts so cli-shell resolves from `extensions/cli-shell` rather than stale `packages/cli-shell`.

## 2. Product SDK Contract

- [x] 2.1 Define generic product binding output that includes product key, bound TerminalSystem terminal id, bound MessageSystem room id, AvatarRuntime identity, and attention context ids.
- [ ] 2.2 Add or revise client-sdk/runtime-store facades for terminal projection/input/read/await/approval subscriptions.
- [ ] 2.3 Add or revise client-sdk/runtime-store facades for room snapshot/send/focus needed by TUI products.
- [ ] 2.4 Add or revise product context delivery for selected Avatars without overwriting prompt files.
- [x] 2.5 Define the minimal generic carrier for current product binding facts without inventing a cli-shell-only prompt path.
- [ ] 2.6 Add BDD contract tests proving SDK APIs are core-noun based and do not import cli-shell implementation.

## 3. cli-shell Bootstrap And Runtime

- [x] 3.1 Rework cli-shell bootstrap to bind current TerminalSystem terminal and MessageSystem room through generic product binding.
- [ ] 3.2 Ensure `--avatar`, `--create-avatar`, and `--clear-avatar` keep their current user-facing semantics without "test Avatar" coupling.
- [ ] 3.3 Ensure explicit selected Avatars receive current product binding context.
- [x] 3.3.1 Rewrite `extensions/cli-shell/src/shell-assistant-seeds.ts` so MessageRoom dialogue defaults to the current bound TerminalSystem terminal instead of tmux session truth.
- [ ] 3.4 Remove runtime dependence on tmux pane ids as terminal operation targets.
- [ ] 3.5 Keep tmux/OpenTUI code only as presentation/layout/input host code over SDK-bound resources.

## 4. Interaction Surfaces

- [ ] 4.1 Rebind Chat/Room TUI to MessageSystem room truth through SDK facades.
- [ ] 4.2 Rebind terminal display/input to TerminalSystem projection/input truth through SDK facades.
- [ ] 4.3 Rebind TopLayer approval popup to TerminalSystem approval request truth and approve/deny APIs.
- [ ] 4.4 Rebind managed status click to attention commit/settle only.
- [ ] 4.5 Preserve the already-fixed Chat empty-surface click-to-focus-input behavior.

## 5. BDD And Real AI Validation

- [ ] 5.1 Add BDD tests proving fresh `--session=7 --avatar=bangeel` binds a current TerminalSystem terminal and ignores stale cli-shell residue.
- [x] 5.1.1 Rewrite the current cli-shell fake-store and bootstrap tests so they stop encoding the false law `active cli-shell must not use TerminalSystem`.
- [ ] 5.1.2 Rename stale `shell-*:terminal-2` fixtures in generic client-sdk and terminal-system tests so they no longer imply cli-shell ontology as platform truth.
- [x] 5.1.3 Rewrite tmux-host missing-host tests so they assert “no legacy host fallback” without reviving `terminal-2` wording.
- [ ] 5.2 Add BDD tests proving Avatar-visible context contains current cli-shell product binding.
- [ ] 5.2.1 Add BDD tests proving Avatar-visible binding facts do not require AGENTER.mdx rewrites.
- [ ] 5.3 Add BDD tests proving terminal writes from cli-shell target the bound TerminalSystem terminal id, not tmux pane ids or old terminal catalog rows.
- [ ] 5.4 Add BDD tests proving authorization popup state comes from TerminalSystem and mouse approve/deny calls TerminalSystem APIs.
- [ ] 5.5 Add BDD tests proving managed on/off only commits/settles attention and never grants terminal authority.
- [ ] 5.6 Run real AI validation with `bun agenter shell --session=7 --avatar=bangeel --create-avatar --clear-avatar`.
- [ ] 5.7 Verify the Avatar no longer says "no independent terminal" when the bound TerminalSystem terminal exists.
- [ ] 5.8 Verify the Avatar does not write to stale `shell-4:terminal-2` or `shell-5:terminal-2` when operating session 7.

## 6. Cleanup And Closure

- [ ] 6.1 Keep cleanup as an SDK-driven lifecycle action over TerminalSystem, MessageSystem, AvatarRuntime, and local presentation hosts.
- [ ] 6.2 Ensure runtime correctness does not require old residue cleanup.
- [ ] 6.3 Run targeted package tests for client-sdk, product-extension-runtime, terminal-system integrations, and cli-shell.
- [x] 6.4 Run `openspec validate realign-cli-shell-with-core-system-boundaries --strict`.

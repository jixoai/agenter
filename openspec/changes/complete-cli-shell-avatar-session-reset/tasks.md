> Boundary note:
> The create/clear Avatar semantics in this task list remain valuable.
> But completed browser-host items are historical input only, and any old “current opened terminal” wording must now be interpreted as the current bound TerminalSystem terminal under `realign-cli-shell-with-core-system-boundaries`.

## 1. OpenSpec And Documentation

- [x] 1.1 Record the settled product decisions: use `--create-avatar` / `--clear-avatar`, clear only runtime session context, keep selected/created Avatars ordinary, and do not couple WebUI to cli-shell.
- [x] 1.2 Update durable package specs after implementation: `extensions/cli-shell/SPEC.md` and `packages/product-extension-runtime/SPEC.md`.
- [x] 1.3 Update user-facing README/help text for `--avatar`, `--create-avatar`, `--clear-avatar`, and the difference from `--session`.
- [x] 1.4 Run `openspec validate complete-cli-shell-avatar-session-reset --strict`.

## 2. Cli-shell Argument And Bootstrap Flow

- [x] 2.1 Extend `CliShellAttachArgs` with `createAvatar` and `clearAvatar` booleans.
- [x] 2.2 Parse `--avatar=<nickname>` and reject conflicts with positional `@nickname`.
- [x] 2.3 Parse `--create-avatar` and `--clear-avatar` as explicit attach-only flags.
- [x] 2.4 Reject `--test-avatar` and keep it out of help because the system has only ordinary Avatar selection for this flow.
- [x] 2.5 Update startup output so non-interactive attach prints selected Avatar, created/reused state, and cleared/not-cleared state.

## 3. Product-Safe Avatar Create And Clear

- [x] 3.1 Resolve selected Avatar from global catalog before terminal or room mutation.
- [x] 3.2 If missing and `--create-avatar` is true, create the ordinary Avatar through generic product-extension/global Avatar APIs.
- [x] 3.3 If missing and `--create-avatar` is false, fail before creating runtime, terminal, or room resources.
- [x] 3.4 Implement selected Avatar runtime-session clear through generic session deletion/reset before `ensureRuntime`.
- [x] 3.5 Preserve canonical Avatar assets during clear: principal, nickname alias, `AGENTER.mdx`, memory files, profile media, and workspace files.
- [x] 3.6 Ensure `--create-avatar` does not create a special prompt, memory pack, classify value, or mode solely because the Avatar is being used for cli-shell verification.
- [x] 3.7 Ensure `--clear-avatar` preserves `AGENTER.mdx`, memory files, profile media, principal identity, workspace files, terminal resources, and room resources.

## 4. Authorization Popup Current-Bound-Terminal Scope

- [x] 4.1 Identify and document the cli-shell bound terminal id in bootstrap/host state.
- [x] 4.2 Update native cli-shell to retain permission request streams for only the current bound terminal.
- [x] 4.3 Pass current-terminal request rows to `shell-terminal-view` without adding hidden/internal terminal subscriptions.
- [x] 4.4 Verify `shell-terminal-view` renders only requests for its opened terminal id.
- [x] 4.5 Ensure Approve/Deny calls `approveGlobalTerminalRequest` / `denyGlobalTerminalRequest` with the bound terminal id and original request id.
- [x] 4.6 Prove managed/takeover state is not mutated by rendering, approving, or denying a permission request.
- [x] 4.7 Add a regression test that fails if Shell Assistant creates a guard write request on a terminal other than the cli-shell bound terminal for room-bound terminal work.

## 5. Historical Browser-Host Experiments (Superseded)

- [x] 5.1 Record that browser-host experiments must not redefine cli-shell shell truth, room truth, or authorization truth.
- [x] 5.2 Preserve the generic terminal-view rule that permission filtering remains terminal-local.
- [x] 5.3 Preserve the generic rule that default HTML Popover approval UI, when used by some host, must emit the same terminal identity it projects.
- [x] 5.4 Keep WebUI independent from cli-shell launcher, repair, or Avatar catalog controls.

## 6. Tests And Real-AI Acceptance

- [x] 6.1 Add BDD parser tests for `--avatar`, `--create-avatar`, `--clear-avatar`, selector conflicts, missing Avatar errors, and rejected `--test-avatar`.
- [x] 6.2 Add bootstrap tests for create-if-missing, fail-if-missing-without-create, clear-before-runtime-start, default shell-assistant seed-if-missing behavior, and ordinary explicit Avatar prompt/memory preservation.
- [x] 6.3 Add product-extension tests proving clear uses generic session authority and does not delete Avatar assets.
- [x] 6.4 Add native cli-shell tests where a current-opened-terminal permission request appears on the visible surface.
- [x] 6.5 Preserve host-level permission popover coverage as historical evidence without making browser-host behavior current cli-shell truth.
- [x] 6.6 Add terminal-view tests for terminal-local permission filtering, host callback replacement, default TopLayer UI, approve, deny, and coalesced updates.
- [x] 6.7 Add or update real-AI cli-shell validation using a named ordinary Avatar, `--create-avatar`, and `--clear-avatar`; the scenario must prove the model uses the bound TerminalSystem, sees approval pending/approved/denied correctly, and does not perform equivalent visible terminal work through `root_bash` or `workspace_bash`.

## 7. Verification And Cleanup

- [x] 7.1 Run focused cli-shell unit and startup tests.
- [x] 7.2 Run focused terminal-view tests.
- [x] 7.3 Run focused product-extension/client-sdk tests for session clear and permission subscriptions.
- [x] 7.4 Run real cli-shell startup smoke with a new named ordinary Avatar.
- [x] 7.5 Run real-AI validation with the cleared ordinary Avatar runtime session.
- [x] 7.6 Run `bun run --filter '@agenter/cli-shell' typecheck`.
- [x] 7.7 Run `openspec validate --changes --strict` and `openspec validate --specs --strict`.

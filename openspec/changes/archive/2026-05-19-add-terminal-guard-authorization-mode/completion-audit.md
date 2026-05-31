# Completion Audit

## Objective

Complete and apply the guard authorization change so cli-shell Shell Assistant can collaborate with the user on the current terminal through prompt guidance and TerminalSystem authority, then validate the behavior with real AI walkthrough coverage where terminal-1 is the shell truth terminal and terminal-2 is the room/app surface.

## Prompt-To-Artifact Checklist

- Complete the OpenSpec change.
  - Evidence: `openspec/changes/add-terminal-guard-authorization-mode/proposal.md`
  - Evidence: `openspec/changes/add-terminal-guard-authorization-mode/design.md`
  - Evidence: `openspec/changes/add-terminal-guard-authorization-mode/specs/**/*.md`
  - Evidence: `openspec/changes/add-terminal-guard-authorization-mode/tasks.md`
  - Current gate: `tasks.md` is complete after user review of `interaction.md` and `interaction-prototype.html`.

- Apply the change in code and durable specs.
  - Evidence: TerminalSystem guard role, approval request lifecycle, subscription filtering, stale request invalidation, and composed-surface opacity in `packages/terminal-system/src/terminal-control-plane.ts`, `packages/terminal-system/src/terminal-control-plane.types.ts`, and `packages/terminal-system/src/terminal-db.ts`.
  - Evidence: Runtime/API/client guard approval contracts in `packages/app-server/src/runtime-tool-descriptors.ts`, `packages/app-server/src/trpc/router.ts`, `packages/client-sdk/src/runtime-store.ts`, and `packages/client-sdk/src/types.ts`.
  - Evidence: App-extension delegation removal in `packages/app-runtime/src/index.ts`, deletion of `packages/app-runtime/src/delegation.ts`, and deletion of `packages/app-server/src/app-extension-delegation-store.ts`.
  - Evidence: cli-shell managed/hosting and cleanup implementation in `packages/cli-shell/src/managed.ts`, `packages/cli-shell/src/cleanup.ts`, and `packages/cli-shell/src/run-cli-shell.ts`.
  - Evidence: durable specs updated in `openspec/specs/*/spec.md` and package `SPEC.md` files.

- Make the architecture reasonable and app/core boundaries explicit.
  - Evidence: `design.md` states guard is TerminalSystem authority, managed/hosting is app attention, app delegation is removed, and TerminalSystem composed surfaces are app-opaque frames.
  - Evidence: boundary comments and tests prevent cli-shell chrome or delegation authority from re-entering core packages.
  - Evidence: `rg "ProductDelegation|app delegation|productDelegation|delegation" openspec/specs packages` leaves only negative/removal language, tests, or unrelated third-party generated code.

- Use prompt guidance to make Shell Assistant focus on the bound cli-shell terminal.
  - Evidence: `packages/cli-shell/src/shell-assistant-seeds.ts` says MessageRoom conversation defaults to the bound TerminalSystem instance, root workspace is hidden as an entry environment, terminal actions go through terminal APIs, guard approval is pending terminal work, deny/expiry do not authorize fallback execution, and managed mode does not change write authority.

- Validate that Shell Assistant can collaborate with the user to control the terminal.
  - Evidence: `packages/cli-shell/test/real-cli-shell-guard-authorization.integration.test.ts` creates real cli-shell fixtures, sends user room messages, waits for model calls, approves through TerminalSystem, checks terminal-1 shell truth output, checks terminal-2 remains composed app surface, and requires message-system replies.

- Validate terminal-1 / terminal-2 split.
  - Evidence: real AI scenario checks `fixture.readShellTruthTerminal(...)` contains the approved marker and verifies visible terminal metadata has `terminalRuntimeKind === "composed"` plus `composedShellTerminalId` pointing at the shell truth terminal.

- Validate no root/workspace bash substitution.
  - Evidence: real AI scenario extracts tool traces and fails if `root_bash` or `workspace_bash` executes target terminal markers outside runtime-local `terminal` or `message` CLI commands.

- Validate AI-as-judge behavior.
  - Evidence: real AI scenario uses `createSemanticJudge(...)` with a structured rubric requiring terminal-first workflow, approval-then-resume behavior, visible terminal execution, and no root/workspace substitution.

- Validate cleanup.
  - Evidence: `packages/cli-shell/src/cleanup.ts`.
  - Evidence: cli-shell cleanup tests cover dry-run, confirmed cleanup, scoped cleanup, interruption reporting, and startup cleanup mode.
  - Evidence: final local dry-run output reported `targets: 0`.

## Verification Evidence

- `openspec validate add-terminal-guard-authorization-mode --strict`: passed.
- `openspec validate --changes --strict`: passed, 10 changes.
- `openspec validate --specs --strict`: passed, 164 specs.
- `git diff --check`: passed.
- `bun run --filter '@agenter/cli-shell' typecheck`: passed.
- `bun run --filter '@agenter/terminal-view' typecheck`: passed.
- `bun run --filter '@agenter/terminal-view' test`: passed, 41 tests.
- `bun test packages/terminal-system/test/control-plane.test.ts --timeout 120000 --test-name-pattern "guard|permission|stale|subscription|approval"`: passed, 11 tests.
- `bun test packages/client-sdk/test/runtime-store.test.ts --timeout 120000 --test-name-pattern "permission|guard|approval"`: passed, 2 tests.
- `bun test packages/app-server/test/runtime-cli.test.ts packages/app-server/test/trpc-router.test.ts --timeout 120000 --test-name-pattern "guard|permission|approval|terminal write|terminal input"`: passed, 4 tests.
- `bun test packages/cli-shell/test/cli-shell.test.ts --timeout 120000 --test-name-pattern "cleanup|managed mode"`: passed, 5 tests.
- `bun test packages/cli-shell/test/cli-shell-startup.test.ts --timeout 120000 --test-name-pattern "cleanup mode|default session|default"`: passed, 1 test.
- `bun test packages/cli-shell/test/cli-shell.integration.test.ts --timeout 120000`: passed, 7 tests.
- `bun test packages/cli-shell/test/cli-shell-tui.test.ts --timeout 120000 --test-name-pattern "permission|approval|TopLayer|guard"`: passed, 5 tests.
- `bun test packages/app-runtime/test/app-runtime.test.ts --timeout 120000`: passed, 8 tests.
- `bun test packages/cli-shell/test/real-cli-shell-guard-authorization.integration.test.ts --timeout 120000`: current environment skipped both real-AI scenarios as expected without `AGENTER_RUN_REAL_LOOPBUS=1`.
- Forced real AI walkthrough evidence from this change run: DeepSeek `deepseek-chat` with `AGENTER_RUN_REAL_LOOPBUS=1` passed the main room-terminal/admin-approval scenario, including terminal-1 marker, terminal-2 composed surface, and semantic judge acceptance.
- `bun packages/cli/src/bin/agenter.ts shell cleanup`: dry-run reported `targets: 0`.

## Remaining Gate

No OpenSpec task gate remains. `tasks.md` is complete, and this audit was refreshed after the user accepted the interaction story in `interaction.md` and `interaction-prototype.html`.

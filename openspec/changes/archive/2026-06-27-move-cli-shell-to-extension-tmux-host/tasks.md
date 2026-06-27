> Superseded note:
> Treat these completed tasks as historical record only.
> Before any future implementation or replay, follow `realign-cli-shell-with-core-system-boundaries` instead of this task list.

## 1. OpenSpec

- [x] 1.1 Write proposal, design, and delta specs for extension layout, tmux host, cli-shell app, launcher, app-extension runtime, and TerminalSystem boundary.
- [x] 1.2 Validate `move-cli-shell-to-extension-tmux-host` with `openspec validate --strict`.

## 2. Workspace And Launcher

- [x] 2.1 Add `apps/*` to root workspace configuration.
- [x] 2.2 Move `agenter-app-shell` from `packages/cli-shell` to `apps/cli-shell`.
- [x] 2.3 Update app command launcher local-first resolution to search app workspace roots without cli-shell-specific branches.
- [x] 2.4 Update launcher BDD tests for extension-local cli-shell and package-local Studio fallback.

## 3. cli-shell Runtime

- [x] 3.1 Replace active cli-shell attach runtime with extension-local tmux host.
- [x] 3.2 Preserve room-only mode as the MessageRoom TUI entry.
- [x] 3.3 Remove active `terminal-1`, `terminal-2`, composed terminal metadata, and composed surface publication from attach bootstrap.
- [x] 3.4 Add typed tmux command planning and executor seams.
- [x] 3.5 Add clear runtime error when tmux is missing or unsupported.

## 4. Cleanup

- [x] 4.1 Extend cleanup planning to include cli-shell tmux sessions.
- [x] 4.2 Ensure cleanup can remove tmux sessions, MessageRoom resources, runtime sessions, and legacy terminal residue in the correct order.
- [x] 4.3 Add BDD tests for cleanup command behavior.

## 5. Tests And Boundaries

- [x] 5.1 Add BDD tests proving attach bootstrap does not create TerminalSystem terminals.
- [x] 5.2 Add BDD tests proving attach startup launches a tmux session with shell and room panes.
- [x] 5.3 Add source boundary tests proving active cli-shell runtime does not import or call composed TerminalSystem publication.
- [x] 5.4 Update package boundary tests after moving cli-shell to `apps/cli-shell`.
- [x] 5.5 Run targeted tests for `@agenter/cli`, `@agenter/app-runtime`, and `agenter-app-shell`.

## 6. Build And Delivery

- [x] 6.1 Add cli-shell binary compile scripts for `windows-amd64`, `linux-amd64`, and `macos-arm64`.
- [x] 6.2 Compile all three targets and record evidence.
- [x] 6.3 Run typecheck for the affected packages.
- [x] 6.4 Write the legacy residue and cleanup risk audit.

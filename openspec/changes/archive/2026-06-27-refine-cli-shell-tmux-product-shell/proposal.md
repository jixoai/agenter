> Superseded note:
> This change remains useful as interaction-story input for Help/Chat/status/top-layer behavior.
> Its architecture assumptions about tmux-native app truth are superseded by `realign-cli-shell-with-core-system-boundaries`.

## Why

The first tmux migration fixed the core/app boundary, but it reduced cli-shell's app UI to a shallow tmux split: one shell pane plus one always-visible room pane. That removed the expected Chat entry and bottom status bar.

cli-shell should not go back to TerminalSystem `terminal-2`. The missing layer is a tmux-native app shell: tmux should host the interaction chrome through status line, key bindings, popup entry, and an explicit pane fallback policy.

## What Changes

- Add a tmux-native cli-shell app shell plan owned by `apps/cli-shell`.
- Keep one primary shell pane as the default foreground work surface.
- Restore a bottom status bar with session, Avatar, clickable managed state, right-side Help/Chat entries, and active-surface highlighting.
- Add tmux key bindings for Chat popup, Chat pane fallback, shell focus, and status refresh.
- Make Chat open through `tmux display-popup` by default instead of forcing a permanent right split.
- Reuse the launcher-provided cli-shell command for Chat popup/Dock room commands instead of guessing a bin path from `import.meta.url`.
- Keep an explicit `split-pane` fallback for terminals or tmux versions where popup is not appropriate.
- Isolate cli-shell inside its own tmux socket namespace so app bindings do not mutate the user's default tmux server.
- Store Avatar, daemon endpoint, workspace, and managed state as session-local tmux options so key bindings work for multiple cli-shell sessions.
- Make cleanup target the same cli-shell-owned tmux socket namespace.
- Add BDD tests for status bar configuration, Chat entry, key bindings, popup strategy, pane fallback, and execution order.

## Impact

- `apps/cli-shell/src/tmux-host.ts`
- `apps/cli-shell/test/tmux-host.test.ts`
- `apps/cli-shell/SPEC.md`
- `apps/cli-shell/README.md`
- `openspec/changes/refine-cli-shell-tmux-app-shell/**/*`

# @agenter/tmux-client

`@agenter/tmux-client` is a generic TypeScript client for tmux.

## Boundary

- The package only models tmux concepts: sessions, windows, panes, options, key bindings, popups, and tmux command execution.
- The package must not import or reference agenter app concepts such as Avatar, MessageRoom, TerminalSystem, cli-shell, or Studio.
- The public API is TypeScript-first and exports source files directly. It does not require a build step or generated `dist` output.

## Execution Model

- The default backend executes `tmux` through argv-based process spawning.
- Higher-level code must call typed methods instead of building large shell scripts.
- Shell command strings are allowed only where tmux itself requires a `shell-command` argument, such as `display-popup`, `run-shell`, `split-window`, or `new-session`.
- The executor is injectable so a future control-mode backend can preserve the same public API.

## Status Bar Model

- The status bar API is a generic tmux DSL: text items, button items, styles, rendered status-left/status-right strings, and set-option command generation.
- Button ids are tmux `range=user|<id>` payloads. The library validates range ids before rendering and provides a parser for status click payloads.
- Conditional status formats must escape literal commas and braces inside active/inactive branches so tmux parses style blocks as format branches instead of leaking fragments such as `noblink]` onto the visible status bar.
- Mouse bindings are generic tmux bindings. App code supplies its own handler command; this package does not know app actions or app state.
- When app code declares a minimum client width, status-left/status-right length budgets must fit within that width before installation; otherwise tmux can let one side swallow another side's mouse ranges.
- Status bar installation emits typed tmux argv commands. App code should pass a declarative definition instead of hand-building status format strings.

## Testing

- Unit tests must cover command argv generation through a fake executor.
- Status bar tests must remain app-agnostic and assert tmux concepts only: rendered format strings, range validation, click binding argv, and option command generation.
- Integration tests may use an isolated tmux socket when tmux is installed, and must not touch user tmux sessions. Status mouse range regressions must be covered here with app-agnostic action ids.

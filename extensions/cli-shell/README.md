# agenter-ext-shell

`agenter shell` starts the cli-shell extension product around one selected Avatar, one product-local tmux session, and one MessageRoom.

```bash
agenter shell --avatar=review-4 --session=4 --create-avatar --clear-avatar
```

Key options:

- `--avatar=<nickname>` selects a normal Avatar. Positional `@nickname` is the shorthand; using both with different names fails before attach.
- `--create-avatar` allows cli-shell to create the selected Avatar if it does not exist.
- `--clear-avatar` clears only the selected Avatar's runtime session for the current workspace before attach.
- `--session=<name>` selects the cli-shell product resource key. For example, `--session=4` maps to tmux session `shell-4`.
- `--tmux=<path>` selects the tmux executable. It defaults to `tmux`.

cli-shell is hosted by tmux, but tmux is only the local host shell. The actual shell target still comes from TerminalSystem through product binding, and MessageRoom still comes from MessageSystem.

cli-shell uses a dedicated tmux socket named `agenter-cli-shell`. Its status bar and key bindings stay inside that product-owned tmux server instead of changing your normal tmux server.

## Tmux product shell

The default attach opens the primary shell pane. Chat is not forced into a permanent right split.

cli-shell installs a bottom tmux status bar. The left side identifies the current product session, and the right side keeps the clickable actions visible:

```text
cli-shell  shell-5  @bangeel  ◉ Avatar started; waiting for new Heartbeat...  managed:off                         Help  Chat
```

The default tmux window list is hidden in cli-shell sessions so it does not push the product actions off screen.

Mouse:

- Mouse is enabled by default so the status bar can be clicked.
- Click `managed:on/off`, `Help`, or `Chat` in the status bar.
- `Mouse` toggles tmux mouse capture. Turning it off restores native terminal text selection, but status clicks are disabled until Mouse is turned on again with `Ctrl+b`, then `m`.
- The currently active surface is highlighted in the status bar instead of repeating shortcut text.
- The left side also carries a compact Avatar Heartbeat preview so the product chrome still reflects assistant activity.
- `Dock`, `Mouse`, `Shell`, and `Refresh` remain keyboard-accessible expert actions instead of visible right-side status entries.

Default keys:

- `Ctrl+b`, then `?`: open the controls panel.
- `Ctrl+b`, then `c`: open Chat in a tmux popup.
- `Ctrl+b`, then `C`: open Chat as a persistent dock pane.
- `Ctrl+b`, then `m`: toggle Mouse.
- `Ctrl+b`, then `s`: focus the primary shell pane.
- `Ctrl+b`, then `r`: refresh the cli-shell status bar.
- `Ctrl+b`, then `[`: enter copy-mode for page scrolling/search/copy. Press `q` to exit.

Chat popups run the cli-shell OpenTUI MessageRoom surface. tmux only hosts the popup or dock pane; it is not the Chat UI implementation. The Chat titlebar has a close button. Its `◨`, `◧`, and `⿴` controls request tmux layouts: left dock, right dock, and cover popup. They do not resize Chat's internal OpenTUI layout.

Chat is a singleton per cli-shell tmux session. If a docked Chat pane already exists, clicking `Chat` focuses that pane instead of opening a second popup. Switching to cover mode closes the dock pane first, then opens the popup.

If the room command exits unexpectedly, the popup stays open and shows the exit status. A normal titlebar close exits immediately.

Cleanup uses the same tmux socket namespace:

```bash
agenter shell cleanup --session=5 --confirm
```

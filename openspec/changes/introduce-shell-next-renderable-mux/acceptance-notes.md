## 2026-05-26 Acceptance Notes

### 7.4 Real Terminal Smoke

Command:

```bash
bun run agenter shell2 --command /bin/sh
```

Observed in a real PTY session:

- Startup mounted one protocol-backed shell pane titled `Shell pane-1`.
- The statusbar rendered `Idle · 1 focused · 0 background · 0 muted` with right-side `Help  Chat` actions visible.
- Terminal input was routed to the focused pane; `printf 'smoke-one\n'` rendered `smoke-one`.
- `Ctrl+N` split the focused pane right and mounted `Shell pane-2`.
- Input after split was routed to the newly focused pane; `printf 'smoke-two\n'` rendered in pane 2.
- `Shift+Left` moved focus back to pane 1; `printf 'smoke-one-again\n'` rendered in pane 1.
- `F1` opened the OpenTUI-native Help renderable inside the layout tree and showed shell-next shortcuts.
- `Ctrl+Q` exited shell-next, restored terminal modes, and the process returned exit code `0`.

The first smoke run exposed a cleanup bug: after `Ctrl+Q`, late Bun PTY exit callbacks tried to update a destroyed statusbar and triggered `TextBuffer is destroyed`. The implementation now treats dispose as the terminal source lifecycle boundary and ignores late frame/exit callbacks after app destruction. Regression coverage was added in `extensions/shell-next/test/shell-next-app.test.ts` under:

```txt
Scenario: Given shell-next is destroyed When a pane exits later Then cleanup remains idempotent
```

### 7.5 Shell And Shell2 Side-By-Side

Acceptance state:

- `bun agenter shell` remains descriptor-routed to `agenter-ext-shell`.
- `bun agenter shell2` is descriptor-routed to local workspace package `agenter-ext-shell-next`.
- `shell2` has `allowInstalled: false` and `allowRemote: false`, so it remains local incubation only.
- No `extensions/cli-shell` rename happened in this change.
- No stable `shell` package name, bin name, or command was replaced by shell-next.

Verification commands:

```bash
openspec validate introduce-shell-next-renderable-mux --strict
bun test extensions/shell-next/test/*.test.ts
bun test packages/cli/test/product-command-launcher.test.ts
bun run --filter 'agenter-ext-shell-next' typecheck
bun run agenter shell2 --command /bin/sh
```

### 8. Product Completion Correction

The earlier 45/45 task state represented mux/layout foundation acceptance only. Product completion now adds the missing terminal projection and product-surface corrections:

- `ShellNextMuxRenderable` accepts a product-free terminal pane factory, so mux/layout does not hardcode the plain text terminal renderer.
- shell-next product wiring defaults to `ShellNextFrameBufferTerminalPane`, which reuses cli-shell's `BackendTerminalFrameRenderable -> ShellTerminalViewRenderable -> FrameBufferRenderable` projection stack.
- `LocalBunTerminalProtocolSource` now exposes rich-line, cursor, viewport, and scrollback facts from Termless/Ghostty via structured rendering.
- `CliShellLiveTerminalProtocolSource` adapts real cli-shell/TerminalSystem transport channels through `createCliShellLiveTerminalMirror` into shell-next's normalized terminal source contract.
- Help and Chat are both visible product actions; `F1` toggles Help and `F3` toggles a direct OpenTUI Chat surface.

Verification commands run after this correction:

```bash
bun test extensions/shell-next/test/*.test.ts
bun run --filter 'agenter-ext-shell-next' typecheck
bun test packages/cli/test/product-command-launcher.test.ts
openspec validate introduce-shell-next-renderable-mux --strict
```

Additional real PTY smoke after the FrameBuffer correction:

```bash
bun run agenter shell2 --command /bin/sh
```

Observed:

- `Shell pane-1` rendered through the frame-backed terminal surface.
- `printf 'fb-smoke\n'` rendered `fb-smoke` inside the shell pane.
- `F3` opened the `Chat` OpenTUI surface in the layout tree.
- `Ctrl+Q` exited with status code `0` and restored terminal modes.

# @agenter/cli-shell

## Terminal-1 FrameBuffer experiment

`experiments/terminal1-framebuffer-experiment.ts` is a focused diagnostic entry for the Terminal-1 projection path. It starts one shell backend, projects its viewport into an OpenTUI `FrameBufferRenderable`, and keeps the chat/composition product path out of the run. Use it when validating backend rendering speed, cursor behavior, selection/copy/paste, scroll handling, and large-output behavior such as `cat AGENTS.md`.

Run from the repository root:

```bash
bun --cwd packages/cli-shell experiments/terminal1-framebuffer-experiment.ts -- --backend=xterm --cwd=/Users/kzf/Dev/GitHub/jixoai-labs/agenter
```

Ghostty-native backend with trace logging:

```bash
bun --cwd packages/cli-shell experiments/terminal1-framebuffer-experiment.ts -- --debug --backend=ghostty-native --cwd=/Users/kzf/Dev/GitHub/jixoai-labs/agenter
```

Useful options:

- `--backend=xterm|ghostty-native`: choose the Terminal-1 backend.
- `--debug`: write perf/render trace events.
- `--fps=30`: set the OpenTUI renderer target FPS.
- `--cwd=<path>`: set the shell working directory.
- `--shell=<command>`: run a custom shell command instead of the login shell.
- `--exit-after-ms=<ms>`: force the experiment to close after a timeout.
- `--print-options`: print the parsed options and exit.

Runtime notes:

- `Ctrl+Q` exits the experiment.
- If Terminal-1 exits, the experiment tears down the renderer/control-plane and the main process exits too.
- The default debug trace path is `.chat/rebuild-cli-shell-terminal-projection-law/terminal1-framebuffer-trace.ndjson`.
- Set `AGENTER_CLI_SHELL_TRACE=<path>` to override the trace path.

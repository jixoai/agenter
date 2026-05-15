import {
  BoxRenderable,
  CliRenderEvents,
  TextRenderable,
  createCliRenderer,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";

import { TerminalAdapter } from "../core/terminal-adapter";
import { encodeTerminalKey } from "../devtools/terminal-input";
import { DebugLogger } from "../infra/logger";
import type { RuntimeConfig } from "./runtime-config";

const MIN_TERMINAL_COLS = 20;
const MIN_TERMINAL_ROWS = 6;

const resolveViewport = (renderer: CliRenderer): { cols: number; rows: number } => ({
  cols: Math.max(MIN_TERMINAL_COLS, renderer.width - 4),
  rows: Math.max(MIN_TERMINAL_ROWS, renderer.height - 5),
});

class CoreDemoApp {
  readonly #renderer: CliRenderer;
  readonly #runtimeConfig: RuntimeConfig;
  readonly #logger: DebugLogger;
  readonly #adapter: TerminalAdapter;
  readonly #root: BoxRenderable;
  readonly #status: TextRenderable;
  readonly #terminal: TextRenderable;
  #running = false;
  #statusText = "starting";
  #disposed = false;

  constructor(renderer: CliRenderer, runtimeConfig: RuntimeConfig) {
    this.#renderer = renderer;
    this.#runtimeConfig = runtimeConfig;
    this.#logger = new DebugLogger(`${runtimeConfig.agentCwd}/demo/logs`);
    const viewport = resolveViewport(renderer);
    this.#adapter = new TerminalAdapter(this.#logger, {
      terminalId: runtimeConfig.primaryTerminalId,
      command: runtimeConfig.terminal.command,
      commandLabel: runtimeConfig.terminal.commandLabel,
      cwd: runtimeConfig.terminal.cwd,
      outputRoot: runtimeConfig.terminal.outputRoot,
      gitLog: runtimeConfig.terminal.gitLog,
      cols: viewport.cols,
      rows: viewport.rows,
    });
    this.#root = new BoxRenderable(renderer, {
      id: "agenter-demo-core-root",
      width: "100%",
      height: "100%",
      flexDirection: "column",
      padding: 1,
    });
    this.#status = new TextRenderable(renderer, {
      id: "agenter-demo-core-status",
      height: 2,
      truncate: true,
    });
    this.#terminal = new TextRenderable(renderer, {
      id: "agenter-demo-core-terminal",
      flexGrow: 1,
      selectable: true,
      wrapMode: "none",
    });
    this.#root.add(this.#status);
    this.#root.add(this.#terminal);
    renderer.root.add(this.#root);
  }

  start(): void {
    this.#adapter.onSnapshot((snapshot) => {
      this.#terminal.content = snapshot.lines.join("\n");
      this.#renderStatus(`seq=${snapshot.seq} cursor=(${snapshot.cursor.x},${snapshot.cursor.y})`);
    });
    this.#adapter.onStatus((running, status) => {
      this.#running = running;
      this.#renderStatus(status);
    });
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    this.#startTerminal();
  }

  destroy(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    void this.#adapter.stop();
    this.#root.destroyRecursively();
  }

  #startTerminal(): void {
    const viewport = resolveViewport(this.#renderer);
    this.#adapter.resize(viewport.cols, viewport.rows);
    this.#adapter.start();
    this.#renderStatus("running");
  }

  #renderStatus(detail: string): void {
    this.#statusText = detail;
    this.#status.content = [
      `agenter demo | ${this.#runtimeConfig.terminal.commandLabel} | ${this.#running ? "running" : "stopped"} | ${this.#statusText}`,
      "Ctrl+C quit | keys are forwarded to the terminal",
    ].join("\n");
    this.#renderer.requestRender();
  }

  #handleResize = (): void => {
    const viewport = resolveViewport(this.#renderer);
    this.#adapter.resize(viewport.cols, viewport.rows);
  };

  #handleKeypress = (key: KeyEvent): void => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      this.#renderer.destroy();
      return;
    }
    const encoded = encodeTerminalKey(key);
    if (!encoded) {
      return;
    }
    key.preventDefault();
    this.#adapter.write(encoded);
  };
}

export const runCoreDemoApp = async (runtimeConfig: RuntimeConfig): Promise<void> => {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const app = new CoreDemoApp(renderer, runtimeConfig);
  renderer.on(CliRenderEvents.DESTROY, () => app.destroy());
  app.start();
};

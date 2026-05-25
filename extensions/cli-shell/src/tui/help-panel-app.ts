import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  ScrollBoxRenderable,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";

import { padCliShellRoomText } from "./room-model";
import { CLI_SHELL_HELP_PANEL_LINES } from "./help-panel-content";

export interface CliShellHelpPanelAppInput {
  shellName: string;
  avatarNickname: string;
  renderer?: CliRenderer;
  onQuit?: () => void;
}

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

export class CliShellHelpPanelApp {
  readonly #input: CliShellHelpPanelAppInput;
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #root: BoxRenderable;
  readonly #title: TextRenderable;
  readonly #scrollBox: ScrollBoxRenderable;
  readonly #footer: TextRenderable;
  readonly #rows: TextRenderable[] = [];
  readonly #startupRenderTimers: Timer[] = [];
  #disposed = false;

  constructor(input: CliShellHelpPanelAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#root = new BoxRenderable(this.#renderer, {
      id: "cli-shell-help-root",
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "#0f172a",
      border: true,
      borderColor: "#38bdf8",
    });
    this.#title = new TextRenderable(this.#renderer, {
      id: "cli-shell-help-title",
      position: "absolute",
      top: 1,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#f8fafc",
      bg: "#0f172a",
    });
    this.#scrollBox = new ScrollBoxRenderable(this.#renderer, {
      id: "cli-shell-help-scrollbox",
      position: "absolute",
      top: 3,
      left: 2,
      width: 1,
      height: 1,
      scrollY: true,
      scrollX: false,
      stickyScroll: false,
      scrollbarOptions: {
        showArrows: false,
      },
    });
    this.#footer = new TextRenderable(this.#renderer, {
      id: "cli-shell-help-footer",
      position: "absolute",
      top: 1,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#94a3b8",
      bg: "#0f172a",
    });
    for (const [index, line] of CLI_SHELL_HELP_PANEL_LINES.entries()) {
      const row = new TextRenderable(this.#renderer, {
        id: `cli-shell-help-row-${index}`,
        width: "100%",
        height: 1,
        content: line,
        fg: index === 0 ? "#7dd3fc" : "#e5e7eb",
        bg: "#0f172a",
      });
      this.#rows.push(row);
      this.#scrollBox.add(row);
    }
    this.#root.add(this.#title);
    this.#root.add(this.#scrollBox);
    this.#root.add(this.#footer);
    this.#renderer.root.add(this.#root);
  }

  start(): void {
    if (this.#disposed) {
      return;
    }
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    this.render("start");
    this.#scheduleStartupRenders();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    while (this.#startupRenderTimers.length > 0) {
      const timer = this.#startupRenderTimers.pop();
      if (timer) {
        clearTimeout(timer);
      }
    }
    this.#root.destroyRecursively();
    if (this.#ownsRenderer) {
      this.#renderer.destroy();
    }
  }

  render(_reason = "manual"): void {
    if (this.#disposed) {
      return;
    }
    const width = Math.max(1, this.#renderer.width);
    const height = Math.max(5, this.#renderer.height);
    const contentWidth = Math.max(1, width - 5);
    this.#root.width = width;
    this.#root.height = height;
    this.#title.width = contentWidth;
    this.#scrollBox.width = contentWidth;
    this.#scrollBox.height = Math.max(1, height - 6);
    this.#footer.top = Math.max(0, height - 2);
    this.#footer.width = contentWidth;
    this.#title.content = padCliShellRoomText(
      `cli-shell Help | ${this.#input.shellName} | @${this.#input.avatarNickname}`,
      contentWidth,
    );
    for (const [index, row] of this.#rows.entries()) {
      row.content = padCliShellRoomText(CLI_SHELL_HELP_PANEL_LINES[index] ?? "", contentWidth);
    }
    this.#footer.content = padCliShellRoomText("Esc/q/Ctrl+Q close", contentWidth);
    this.#renderer.requestRender();
  }

  #handleResize = (): void => {
    this.render("resize");
  };

  #scheduleStartupRenders(): void {
    for (const delayMs of [16, 80, 180]) {
      const timer = setTimeout(() => {
        this.render("startup-stabilized");
      }, delayMs);
      this.#startupRenderTimers.push(timer);
    }
  }

  #handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    if (key.name === "escape" || key.name === "q" || (key.ctrl && key.name === "q")) {
      key.preventDefault();
      this.#input.onQuit?.();
    }
  };
}

export const startCliShellHelpPanelApp = async (
  input: CliShellHelpPanelAppInput,
): Promise<{ app: CliShellHelpPanelApp; renderer: CliRenderer }> => {
  const renderer = input.renderer ?? (await createCliRenderer({ exitOnCtrlC: false, useMouse: true }));
  const app = new CliShellHelpPanelApp({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return { app, renderer };
};

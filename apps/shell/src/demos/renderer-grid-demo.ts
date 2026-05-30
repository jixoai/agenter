import { CliRenderEvents, createCliRenderer, type CliRenderer } from "@opentui/core";

import { createFourPaneLayout, type RootLayout } from "../renderable-mux/layout";
import { DemoPaneRenderable } from "../renderable-mux/pane-renderable";

export interface FourPaneRendererGridDemoInput {
  renderer?: CliRenderer;
  selectionText?: string;
  onQuit?: () => void;
}

export interface FourPaneRendererGridDemoController {
  readonly finished: Promise<void>;
  destroy(): void;
}

const paneMeta = [
  { id: "pane-a", title: "Pane A / renderer source", accentColor: "#38bdf8" },
  { id: "pane-b", title: "Pane B / selectable text", accentColor: "#a78bfa" },
  { id: "pane-c", title: "Pane C / click target", accentColor: "#34d399" },
  { id: "pane-d", title: "Pane D / mixed surface", accentColor: "#fb7185" },
] as const;

interface ShellKeyEvent {
  readonly name: string;
  readonly ctrl?: boolean;
  preventDefault(): void;
}

const readKeyEvent = (value: unknown): ShellKeyEvent | null => {
  if (typeof value !== "object" || value === null || !("name" in value) || !("preventDefault" in value)) {
    return null;
  }
  const { name, preventDefault } = value;
  if (typeof name !== "string" || typeof preventDefault !== "function") {
    return null;
  }
  return {
    name,
    ctrl: "ctrl" in value && typeof value.ctrl === "boolean" ? value.ctrl : false,
    preventDefault: () => {
      preventDefault();
    },
  };
};

export class FourPaneRendererGridDemo implements FourPaneRendererGridDemoController {
  readonly #input: FourPaneRendererGridDemoInput;
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #layout: RootLayout;
  readonly #panes = new Map<string, DemoPaneRenderable>();
  readonly #startupRenderTimers: Timer[] = [];
  readonly #resolveFinished: () => void;
  readonly finished: Promise<void>;
  #disposed = false;

  constructor(input: FourPaneRendererGridDemoInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#layout = createFourPaneLayout({
      x: 0,
      y: 0,
      width: this.#renderer.width,
      height: this.#renderer.height,
    });
    let resolveFinished: () => void = () => undefined;
    this.finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    this.#resolveFinished = resolveFinished;

    for (const node of this.#layout.children) {
      const meta = paneMeta.find((candidate) => candidate.id === node.id);
      if (!meta) {
        continue;
      }
      const pane = new DemoPaneRenderable({
        renderer: this.#renderer,
        node,
        title: meta.title,
        accentColor: meta.accentColor,
        selectionText: input.selectionText ?? "Drag across this selectable text to verify host selection inside pane.",
        onFocus: (paneId) => this.focusPane(paneId),
      });
      this.#panes.set(node.id, pane);
      this.#renderer.root.add(pane.root);
    }
  }

  start(): void {
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    this.render("start");
    for (const delayMs of [16, 80, 180]) {
      const timer = setTimeout(() => {
        this.render("startup-stabilized");
      }, delayMs);
      this.#startupRenderTimers.push(timer);
    }
  }

  focusPane(paneId: string): void {
    if (!this.#layout.focus(paneId)) {
      return;
    }
    this.render("focus");
  }

  render(_reason = "manual"): void {
    if (this.#disposed) {
      return;
    }
    this.#layout.resize({
      x: 0,
      y: 0,
      width: this.#renderer.width,
      height: this.#renderer.height,
    });
    for (const node of this.#layout.children) {
      this.#panes.get(node.id)?.syncNode(node);
    }
    this.#renderer.requestRender();
  }

  destroy(): void {
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
    for (const pane of this.#panes.values()) {
      pane.destroy();
    }
    if (this.#ownsRenderer) {
      this.#renderer.destroy();
    }
    this.#input.onQuit?.();
    this.#resolveFinished();
  }

  #handleResize = (): void => {
    this.render("resize");
  };

  #handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    if (key.name === "escape" || key.name === "q" || (key.ctrl && key.name === "q")) {
      key.preventDefault();
      this.destroy();
      return;
    }
    const focusedIndex = this.#layout.children.findIndex((node) => node.focused);
    if (key.name === "tab") {
      key.preventDefault();
      const next = this.#layout.children[(focusedIndex + 1) % this.#layout.children.length];
      if (next) {
        this.focusPane(next.id);
      }
    }
  };
}

export const startFourPaneRendererGridDemo = async (
  input: FourPaneRendererGridDemoInput = {},
): Promise<FourPaneRendererGridDemoController> => {
  const renderer =
    input.renderer ??
    (await createCliRenderer({ exitOnCtrlC: false, useMouse: true, enableMouseMovement: true }));
  const app = new FourPaneRendererGridDemo({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return app;
};

import { createAgenterClient, createRuntimeStore, type RuntimeClientState, type RuntimeStore } from "@agenter/client-sdk";
import {
  BoxRenderable,
  CliRenderEvents,
  TextRenderable,
  TextareaRenderable,
  createCliRenderer,
  type CliRenderer,
  type KeyEvent,
} from "@opentui/core";

import { buildViewModel, type TuiViewModel } from "./types";

export interface TuiClientOptions {
  host?: string;
  port?: number;
}

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const wsUrl = (host: string, port: number): string => `ws://${host}:${port}/trpc`;
const withLineLimit = (lines: string[], limit: number): string => lines.slice(Math.max(0, lines.length - limit)).join("\n");

const normalizeInput = (input: string): string => input.trim();

class AgenterCoreTuiApp {
  readonly #renderer: CliRenderer;
  readonly #host: string;
  readonly #port: number;
  readonly #store: RuntimeStore;
  readonly #root: BoxRenderable;
  readonly #status: TextRenderable;
  readonly #sessionList: TextRenderable;
  readonly #chatLog: TextRenderable;
  readonly #input: TextareaRenderable;
  readonly #tasks: TextRenderable;
  readonly #loopbus: TextRenderable;
  #state: RuntimeClientState;
  #connected = false;
  #activeSessionId: string | null = null;
  #pendingActiveSessionId: string | null = null;
  #releaseStore: (() => void) | null = null;
  #disposed = false;

  constructor(renderer: CliRenderer, options: { host: string; port: number }) {
    this.#renderer = renderer;
    this.#host = options.host;
    this.#port = options.port;
    const client = createAgenterClient({
      wsUrl: wsUrl(options.host, options.port),
      onOpen: () => {
        this.#connected = true;
        this.#render();
      },
      onClose: () => {
        this.#connected = false;
        this.#render();
      },
    });
    this.#store = createRuntimeStore(client);
    this.#state = this.#store.getState();

    this.#root = new BoxRenderable(renderer, {
      id: "agenter-core-tui-root",
      width: "100%",
      height: "100%",
      padding: 1,
      flexDirection: "column",
    });
    this.#status = new TextRenderable(renderer, {
      id: "agenter-core-tui-status",
      height: 1,
      truncate: true,
    });

    const body = new BoxRenderable(renderer, {
      id: "agenter-core-tui-body",
      flexGrow: 1,
      marginTop: 1,
      flexDirection: "row",
    });
    this.#sessionList = new TextRenderable(renderer, {
      id: "agenter-core-tui-sessions",
      width: "32%",
      height: "100%",
      wrapMode: "word",
    });

    const main = new BoxRenderable(renderer, {
      id: "agenter-core-tui-main",
      marginLeft: 1,
      flexGrow: 1,
      flexDirection: "column",
    });
    this.#chatLog = new TextRenderable(renderer, {
      id: "agenter-core-tui-chat",
      flexGrow: 1,
      wrapMode: "word",
      selectable: true,
    });
    this.#input = new TextareaRenderable(renderer, {
      id: "agenter-core-tui-input",
      height: 3,
      marginTop: 1,
      placeholder: "Enter send / Ctrl+N new / Ctrl+Tab switch / Ctrl+C quit",
      wrapMode: "word",
      keyBindings: [
        { name: "return", action: "submit" },
        { name: "linefeed", action: "submit" },
        { name: "return", shift: true, action: "newline" },
        { name: "linefeed", shift: true, action: "newline" },
      ],
      onSubmit: () => this.#submit(),
    });

    const bottom = new BoxRenderable(renderer, {
      id: "agenter-core-tui-bottom",
      marginTop: 1,
      height: "34%",
      flexDirection: "row",
    });
    this.#tasks = new TextRenderable(renderer, {
      id: "agenter-core-tui-tasks",
      width: "45%",
      height: "100%",
      wrapMode: "word",
    });
    this.#loopbus = new TextRenderable(renderer, {
      id: "agenter-core-tui-loopbus",
      marginLeft: 1,
      flexGrow: 1,
      height: "100%",
      wrapMode: "word",
    });

    bottom.add(this.#tasks);
    bottom.add(this.#loopbus);
    main.add(this.#chatLog);
    main.add(this.#input);
    main.add(bottom);
    body.add(this.#sessionList);
    body.add(main);
    this.#root.add(this.#status);
    this.#root.add(body);
    renderer.root.add(this.#root);
  }

  start(): void {
    this.#releaseStore = this.#store.subscribe((next) => {
      this.#state = { ...next };
      this.#syncActiveSession();
      this.#render();
    });
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    this.#input.focus();
    this.#render();
    void this.#store.connect().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      this.#status.content = `agenter-tui ${this.#host}:${this.#port} | connection failed: ${message}`;
      this.#renderer.requestRender();
    });
  }

  destroy(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    this.#releaseStore?.();
    this.#releaseStore = null;
    this.#store.disconnect();
    this.#root.destroyRecursively();
  }

  #syncActiveSession(): void {
    if (this.#activeSessionId && this.#pendingActiveSessionId === this.#activeSessionId) {
      if (this.#state.sessions.some((item) => item.id === this.#activeSessionId)) {
        this.#pendingActiveSessionId = null;
      }
      return;
    }
    if (this.#activeSessionId && this.#state.sessions.some((item) => item.id === this.#activeSessionId)) {
      return;
    }
    this.#activeSessionId = this.#state.sessions[0]?.id ?? null;
  }

  #view(): TuiViewModel {
    return buildViewModel(this.#state, this.#activeSessionId);
  }

  #render(): void {
    const view = this.#view();
    this.#status.content = [
      `agenter-tui ${this.#host}:${this.#port}`,
      this.#connected && view.connected ? "connected" : "connecting",
      `sessions=${view.sessions.length}`,
      view.phaseText,
    ].join(" | ");
    this.#sessionList.content =
      view.sessions.length === 0
        ? "Ctrl+N creates a session"
        : withLineLimit(
            view.sessions.map((session) => {
              const marker = session.id === view.activeSessionId ? "*" : " ";
              return `${marker} ${session.name} [${session.status}]`;
            }),
            Math.max(1, this.#sessionList.height - 2),
          );
    this.#chatLog.content =
      view.messages.length === 0
        ? "(no messages)"
        : withLineLimit(
            view.messages.map((message) => `${message.role === "user" ? "you" : "assistant"}: ${message.content}`),
            Math.max(1, this.#chatLog.height - 2),
          );
    this.#tasks.content =
      view.tasks.length === 0
        ? "(no tasks)"
        : withLineLimit(
            view.tasks.map((task) => `${task.title} [${task.status}] ${Math.round(task.progress * 100)}%`),
            Math.max(1, this.#tasks.height - 2),
          );
    const latestTrace = view.loopbusTraces.at(-1);
    const latestModelCall = view.modelCalls.at(-1);
    this.#loopbus.content = [
      `phase: ${view.phaseText}`,
      `record: ${view.apiRecording.enabled ? `on(${view.apiRecording.refCount})` : "off"}`,
      `trace: ${latestTrace ? `#${latestTrace.cycleId}.${latestTrace.seq} ${latestTrace.name} ${latestTrace.status}` : "none"}`,
      `model: ${latestModelCall ? `${latestModelCall.provider}/${latestModelCall.model}` : "none"}`,
    ].join("\n");
    this.#renderer.requestRender();
  }

  #submit(): void {
    const value = normalizeInput(this.#input.plainText);
    if (!value || !this.#activeSessionId) {
      return;
    }
    this.#input.clear();
    void this.#store.sendChat(this.#activeSessionId, value);
    this.#render();
  }

  #createSession(): void {
    void this.#store
      .createSession({
        cwd: process.cwd(),
        name: `workspace-${createId().slice(-4)}`,
        autoStart: true,
      })
      .then((session) => {
        this.#pendingActiveSessionId = session.id;
        this.#activeSessionId = session.id;
        this.#render();
      });
  }

  #focusNextSession(): void {
    const sessions = this.#view().sessions;
    if (sessions.length === 0) {
      return;
    }
    const currentIndex = sessions.findIndex((item) => item.id === this.#activeSessionId);
    this.#activeSessionId = sessions[(currentIndex + 1 + sessions.length) % sessions.length]?.id ?? null;
    this.#render();
  }

  #handleKeypress = (key: KeyEvent): void => {
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      this.#renderer.destroy();
      return;
    }
    if (key.ctrl && key.name === "n") {
      key.preventDefault();
      this.#createSession();
      return;
    }
    if (key.ctrl && key.name === "tab") {
      key.preventDefault();
      this.#focusNextSession();
      return;
    }
  };

  #handleResize = (): void => {
    this.#render();
  };
}

export const runTuiClient = async (options: TuiClientOptions = {}): Promise<void> => {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4580;
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const app = new AgenterCoreTuiApp(renderer, { host, port });
  renderer.on(CliRenderEvents.DESTROY, () => app.destroy());
  app.start();
};

import type { GlobalRoomMessage, RuntimeClientState } from "@agenter/client-sdk";
import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
} from "@opentui/core";

import type { CliShellRoomBootstrapResult } from "../bootstrap";
import {
  buildCliShellDialogueScrollRows,
  createCliShellDialogueRowsCache,
  type CliShellDialogueRowsCache,
} from "./dialogue-surface";
import {
  CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM,
  CliShellDialogueScrollBoxController,
  type CliShellDialogueScrollRow,
} from "./dialogue-scrollbox";
import { matchCliShellShortcut, type CliShellTuiKeybindings } from "./keybindings";
import { buildCliShellDialogueBlocks } from "./model";
import { createCliShellPerfTracer, type CliShellPerfTracer } from "./perf-trace";
import type { CliShellDialogueWindowState, CliShellTuiStore } from "./types";

interface CliShellRoomViewState {
  draft: string;
  scrollTop: number;
  statusNotice: string | null;
}

export interface CliShellRoomAppProps {
  renderer: CliRenderer;
  store: CliShellTuiStore;
  shellName: string;
  attached: CliShellRoomBootstrapResult;
  keybindings: CliShellTuiKeybindings;
  onQuit: () => void;
  debug?: boolean;
  debugFilters?: readonly string[];
}

const EMPTY_ROOM_STATE: CliShellDialogueWindowState = {
  messages: [],
  messageIds: [],
  nextBefore: null,
  hasMoreBefore: false,
  loadingBefore: false,
  pinnedToBottom: true,
  pendingNewMessageCount: 0,
  anchor: null,
  error: null,
};

const readKeyEvent = (value: unknown): KeyEvent | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as KeyEvent;
};

const resolveMessageWindow = (
  state: RuntimeClientState,
  roomChatId: string,
): CliShellDialogueWindowState => {
  const snapshot = state.globalRoomSnapshotsById[roomChatId]?.data ?? null;
  if (!snapshot) {
    return EMPTY_ROOM_STATE;
  }
  const messages = snapshot.items;
  return {
    messages,
    messageIds: messages.map((message) => message.messageId),
    nextBefore: snapshot.nextBefore,
    hasMoreBefore: snapshot.hasMoreBefore,
    loadingBefore: false,
    pinnedToBottom: true,
    pendingNewMessageCount: 0,
    anchor: null,
    error: null,
  };
};

export const resolveCliShellRoomMessageWindow = resolveMessageWindow;

const formatStatusLine = (input: {
  shellName: string;
  avatarNickname: string;
  statusNotice: string | null;
  width: number;
}): string => {
  const body = input.statusNotice?.trim() || `${input.shellName} room | @${input.avatarNickname} | Ctrl+Q quit`;
  return body.length > input.width ? body.slice(0, Math.max(0, input.width - 1)) : body.padEnd(input.width, " ");
};

const formatDraftLine = (draft: string, width: number): string => {
  const prompt = "> ";
  const available = Math.max(1, width - prompt.length);
  const visibleDraft = draft.length > available ? draft.slice(Math.max(0, draft.length - available)) : draft;
  return `${prompt}${visibleDraft}`.padEnd(width, " ");
};

const preserveUserScrollTop = (scrollTop: number): number => Math.max(0, Math.trunc(scrollTop));

export const buildCliShellRoomDialogueRows = (input: {
  messages: readonly GlobalRoomMessage[];
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number];
  width: number;
  rowsCache?: CliShellDialogueRowsCache;
}): CliShellDialogueScrollRow[] =>
  (
    input.rowsCache ?? {
      getRows: buildCliShellDialogueScrollRows,
    }
  ).getRows({
    model: {
      dialogueBlocks: buildCliShellDialogueBlocks({
        messages: input.messages,
        avatarActorId: input.avatarActorId,
      }),
    },
    width: input.width,
  });

export class CliShellRoomApp {
  readonly #props: CliShellRoomAppProps;
  readonly #renderer: CliRenderer;
  readonly #root: BoxRenderable;
  readonly #scrollBox: CliShellDialogueScrollBoxController;
  readonly #dialogueRowsCache: CliShellDialogueRowsCache;
  readonly #statusLine: TextRenderable;
  readonly #draftLine: TextRenderable;
  readonly #perfTracer: CliShellPerfTracer;
  #viewState: CliShellRoomViewState = {
    draft: "",
    scrollTop: CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM,
    statusNotice: null,
  };
  #state: RuntimeClientState;
  #releaseStore: (() => void) | null = null;
  #releaseRoom: (() => void) | null = null;
  #disposed = false;

  constructor(props: CliShellRoomAppProps) {
    this.#props = props;
    this.#renderer = props.renderer;
    this.#state = props.store.getState();
    this.#perfTracer = createCliShellPerfTracer({ enabled: props.debug === true, filters: props.debugFilters });
    this.#dialogueRowsCache = createCliShellDialogueRowsCache();
    this.#root = new BoxRenderable(this.#renderer, {
      id: "cli-shell-room-root",
      width: "100%",
      height: "100%",
      position: "absolute",
      top: 0,
      left: 0,
    });
    this.#scrollBox = new CliShellDialogueScrollBoxController(this.#renderer, {
      id: "cli-shell-room-scrollbox",
      width: Math.max(1, this.#renderer.width),
      height: Math.max(1, this.#renderer.height - 2),
      rows: [],
      initialScrollTop: CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM,
    });
    this.#scrollBox.scrollBox.onMouseScroll = (event) => this.#handleMouseScroll(event);
    this.#scrollBox.scrollBox.verticalScrollBar.on("change", () => this.#scheduleViewportSync("scrollbar-change"));
    this.#statusLine = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-status",
      position: "absolute",
      left: 0,
      top: Math.max(0, this.#renderer.height - 2),
      width: Math.max(1, this.#renderer.width),
      height: 1,
      content: "",
    });
    this.#draftLine = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-draft",
      position: "absolute",
      left: 0,
      top: Math.max(0, this.#renderer.height - 1),
      width: Math.max(1, this.#renderer.width),
      height: 1,
      content: "",
    });
    this.#root.add(this.#scrollBox.scrollBox);
    this.#root.add(this.#statusLine);
    this.#root.add(this.#draftLine);
    this.#renderer.root.add(this.#root);
    this.#scrollBox.scrollBox.focus();
  }

  start(): void {
    if (this.#disposed) {
      return;
    }
    this.#releaseStore = this.#props.store.subscribe(() => {
      this.#state = this.#props.store.getState();
      this.renderNow("store-update");
    });
    this.#releaseRoom = this.#props.store.retainGlobalRoomSnapshot(this.#props.attached.room.entry.chatId);
    void this.#props.store
      .hydrateGlobalRoomSnapshot({
        chatId: this.#props.attached.room.entry.chatId,
        accessToken: this.#props.attached.room.entry.accessToken,
        force: true,
      })
      .then(() => {
        this.#state = this.#props.store.getState();
        this.renderNow("room-hydrate-finished");
      })
      .catch((error: unknown) => {
        this.#viewState = {
          ...this.#viewState,
          statusNotice: `room hydrate failed: ${error instanceof Error ? error.message : String(error)}`,
        };
        this.renderNow("room-hydrate-error");
      });
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    this.renderNow("start");
    this.#renderer.requestRender();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#releaseStore?.();
    this.#releaseStore = null;
    this.#releaseRoom?.();
    this.#releaseRoom = null;
    this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    this.#perfTracer.dispose();
    this.#root.destroyRecursively();
  }

  renderNow(reason = "manual"): void {
    if (this.#disposed) {
      return;
    }
    const startedAt = performance.now();
    const width = Math.max(1, this.#renderer.width);
    const height = Math.max(3, this.#renderer.height);
    const bodyHeight = Math.max(1, height - 2);
    const window = resolveMessageWindow(this.#state, this.#props.attached.room.entry.chatId);
    const rows = buildCliShellRoomDialogueRows({
      messages: window.messages,
      avatarActorId: this.#props.attached.avatarActorId as GlobalRoomMessage["unreadActorIds"][number],
      width,
      rowsCache: this.#dialogueRowsCache,
    });
    const requestedScrollTop = this.#viewState.scrollTop;
    const snapshot = this.#scrollBox.sync({
      width,
      height: bodyHeight,
      rows,
      scrollTop: requestedScrollTop,
    });
    this.#viewState = {
      ...this.#viewState,
      scrollTop:
        requestedScrollTop >= CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM
          ? CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM
          : preserveUserScrollTop(snapshot.scrollTop),
    };
    this.#root.width = width;
    this.#root.height = height;
    this.#statusLine.top = Math.max(0, height - 2);
    this.#statusLine.width = width;
    this.#statusLine.content = formatStatusLine({
      shellName: this.#props.shellName,
      avatarNickname: this.#props.attached.avatar.nickname,
      statusNotice: this.#viewState.statusNotice,
      width,
    });
    this.#draftLine.top = Math.max(0, height - 1);
    this.#draftLine.width = width;
    this.#draftLine.content = formatDraftLine(this.#viewState.draft, width);
    this.#renderer.requestRender();
    this.#perfTracer.record({
      kind: "room-render",
      detail: {
        reason,
        durationMs: Number((performance.now() - startedAt).toFixed(2)),
        rowCount: rows.length,
        messageCount: window.messages.length,
      },
    });
  }

  #handleResize = (): void => {
    this.renderNow("resize");
  };

  #handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    if (matchCliShellShortcut(key, this.#props.keybindings.quit)) {
      key.preventDefault();
      this.#props.onQuit();
      return;
    }
    if (key.name === "return" || key.name === "linefeed") {
      const task = this.#submitDraft();
      void task;
      key.preventDefault();
      return;
    }
    if (key.name === "backspace" && !key.ctrl && !key.meta && !key.super && !key.option) {
      this.#viewState = {
        ...this.#viewState,
        draft: this.#viewState.draft.slice(0, -1),
        statusNotice: null,
      };
      this.renderNow("draft-backspace");
      key.preventDefault();
      return;
    }
    if (key.name === "up" || key.name === "down") {
      const delta = key.name === "up" ? -1 : 1;
      const snapshot = this.#scrollBox.scrollByRows(delta);
      this.#viewState = {
        ...this.#viewState,
        scrollTop: preserveUserScrollTop(snapshot.scrollTop),
        statusNotice: null,
      };
      this.renderNow("keyboard-scroll");
      key.preventDefault();
      return;
    }
    if (!key.ctrl && !key.meta && !key.super && !key.option) {
      if (key.name === "space") {
        this.#appendDraft(" ");
        key.preventDefault();
        return;
      }
      if (key.sequence) {
        const firstCharCode = key.sequence.charCodeAt(0);
        if (firstCharCode >= 32 && firstCharCode !== 127) {
          this.#appendDraft(key.sequence);
          key.preventDefault();
        }
      }
    }
  };

  #appendDraft(text: string): void {
    this.#viewState = {
      ...this.#viewState,
      draft: `${this.#viewState.draft}${text.replace(/[\n\r]/g, "")}`,
      statusNotice: null,
    };
    this.renderNow("draft-input");
  }

  async #submitDraft(): Promise<void> {
    const text = this.#viewState.draft.trim();
    if (text.length === 0) {
      return;
    }
    this.#viewState = {
      ...this.#viewState,
      statusNotice: "sending room message...",
    };
    this.renderNow("room-submit-start");
    try {
      const result = await this.#props.store.sendGlobalRoomMessage({
        chatId: this.#props.attached.room.entry.chatId,
        accessToken: this.#props.attached.room.entry.accessToken,
        text,
      });
      if (!result.ok) {
        throw new Error(result.reason ?? "message send failed");
      }
      await this.#props.store.hydrateGlobalRoomSnapshot({
        chatId: this.#props.attached.room.entry.chatId,
        accessToken: this.#props.attached.room.entry.accessToken,
        force: true,
      });
      this.#viewState = {
        ...this.#viewState,
        draft: "",
        scrollTop: CLI_SHELL_DIALOGUE_SCROLL_TO_BOTTOM,
        statusNotice: "message sent",
      };
      this.renderNow("room-submit-finished");
    } catch (error) {
      this.#viewState = {
        ...this.#viewState,
        statusNotice: `message send failed: ${error instanceof Error ? error.message : String(error)}`,
      };
      this.renderNow("room-submit-error");
    }
  }

  #handleMouseScroll = (event: MouseEvent): void => {
    if (!event.scroll?.direction) {
      return;
    }
    this.#scheduleViewportSync("mouse-scroll");
  };

  #syncViewportFromHost(reason: string): void {
    if (this.#disposed) {
      return;
    }
    const snapshot = this.#scrollBox.syncFromHostViewport();
    this.#viewState = {
      ...this.#viewState,
      scrollTop: preserveUserScrollTop(snapshot.scrollTop),
      statusNotice: null,
    };
    this.renderNow(reason);
  }

  #viewportSyncQueued = false;

  #scheduleViewportSync(reason: string): void {
    if (this.#viewportSyncQueued) {
      return;
    }
    this.#viewportSyncQueued = true;
    queueMicrotask(() => {
      this.#viewportSyncQueued = false;
      this.#syncViewportFromHost(reason);
    });
  }
}

export const startCliShellRoomApp = async (
  input: Omit<CliShellRoomAppProps, "renderer">,
): Promise<{ app: CliShellRoomApp; renderer: CliRenderer }> => {
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const app = new CliShellRoomApp({
    ...input,
    renderer,
  });
  return { app, renderer };
};

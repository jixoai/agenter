import type { GlobalRoomMessage, GlobalRoomSnapshotOutput, RuntimeClientState } from "@agenter/client-sdk";
import { BoxRenderable, TextRenderable, type CliRenderer, type KeyEvent, type MouseEvent } from "@opentui/core";

import type { ChildLayoutNode } from "../renderable-mux/layout";
import {
  ShellPaneChromeController,
  resolveShellPaneChromeClick,
  shellPaneCloseAction,
  type ShellPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import { ShellButtonPressController } from "../renderable-mux/button-press-controller";
import { PANE_CONTENT_ORIGIN, resolveBorderedPaneContentSize } from "../renderable-mux/pane-content-geometry";
import type { OpenTuiRenderableSurface } from "../renderable-mux/pane-source";
import {
  createShellRendererSelectionBehavior,
  type ShellRendererSelectionBehavior,
} from "../renderable-mux/renderer-selection";

export interface ShellRoomSurfaceStore {
  getState?(): Pick<RuntimeClientState, "globalRoomSnapshotsById">;
  subscribe?(listener: () => void): () => void;
  retainGlobalRoomSnapshot(chatId: string): () => void;
  hydrateGlobalRoomSnapshot(input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
    force?: boolean;
  }): Promise<GlobalRoomSnapshotOutput | null>;
  sendGlobalRoomMessage(input: {
    chatId: string;
    accessToken?: string;
    text: string;
  }): Promise<{ ok: boolean; reason?: string }>;
}

export interface ShellRoomSurfaceInput {
  renderer: CliRenderer;
  node: ChildLayoutNode;
  store: ShellRoomSurfaceStore;
  chatId: string;
  accessToken?: string;
  title?: string | null;
  onFocus?: (paneId: string) => void;
  onClose?: (paneId: string) => void;
}

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

const messageText = (message: GlobalRoomMessage): string => {
  const sender = message.from || message.senderContactId || "unknown";
  const content = message.content ?? "";
  return `[${sender}] ${content}`;
};

const readSnapshotMessages = (
  store: ShellRoomSurfaceStore,
  chatId: string,
): readonly GlobalRoomMessage[] | null => {
  const snapshot = store.getState?.().globalRoomSnapshotsById[chatId]?.data;
  return snapshot?.items ?? null;
};

export class ShellRoomSurface implements OpenTuiRenderableSurface {
  readonly #renderer: CliRenderer;
  readonly #store: ShellRoomSurfaceStore;
  readonly #chatId: string;
  readonly #accessToken: string | undefined;
  readonly #titleText: string;
  readonly #root: BoxRenderable;
  readonly #content: TextRenderable;
  readonly #draft: TextRenderable;
  readonly #status: TextRenderable;
  readonly #onFocus: ((paneId: string) => void) | undefined;
  readonly #onClose: ((paneId: string) => void) | undefined;
  readonly #chrome: ShellPaneChromeController;
  readonly #buttonPress: ShellButtonPressController<string>;
  readonly #selectionBehavior: ShellRendererSelectionBehavior;
  #node: ChildLayoutNode;
  #chromeRegions: readonly ShellPaneChromeHitRegion[] = [];
  #hoveredChromeAction: string | null = null;
  #releaseRoom: (() => void) | null = null;
  #releaseStore: (() => void) | null = null;
  #messages: readonly GlobalRoomMessage[] = [];
  #draftText = "";
  #notice = "loading room...";
  #disposed = false;

  constructor(input: ShellRoomSurfaceInput) {
    this.#renderer = input.renderer;
    this.#store = input.store;
    this.#chatId = input.chatId;
    this.#accessToken = input.accessToken;
    this.#titleText = input.title?.trim() || input.chatId;
    this.#node = input.node;
    this.#onFocus = input.onFocus;
    this.#onClose = input.onClose;
    this.#selectionBehavior = createShellRendererSelectionBehavior({
      renderer: this.#renderer,
      resolveTargets: () => [this.#content, this.#draft, this.#status].map((renderable) => ({ renderable })),
    });
    this.#buttonPress = new ShellButtonPressController({
      resolveAction: (event) => resolveShellPaneChromeClick({ event, regions: this.#chromeRegions }),
      onClick: (_action, event) => {
        event.preventDefault();
        this.#onClose?.(this.#node.id);
      },
      onHoverChange: (action) => {
        if (action === this.#hoveredChromeAction) {
          return;
        }
        this.#hoveredChromeAction = action;
        this.syncNode(this.#node);
      },
    });
    this.#chrome = new ShellPaneChromeController({
      renderer: this.#renderer,
      id: `${input.node.id}-room-chrome`,
      bg: "#0f172a",
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseUp: (event) => this.#handleMouseUp(event),
      onMouseMove: (event) => this.#handleMouseMove(event),
    });
    this.#root = new BoxRenderable(this.#renderer, {
      id: `${input.node.id}-room-root`,
      position: "absolute",
      border: true,
      borderStyle: "rounded",
      borderColor: input.node.focused ? "#22c55e" : "#475569",
      focusedBorderColor: "#22c55e",
      backgroundColor: "#0f172a",
      titleAlignment: "left",
      focusable: true,
    });
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#root.onMouseUp = (event) => this.#handleMouseUp(event);
    this.#root.onMouseMove = (event) => this.#handleMouseMove(event);
    this.#content = this.#createText(`${input.node.id}-room-content`, 1, "#e5e7eb");
    this.#draft = this.#createText(`${input.node.id}-room-draft`, 1, "#f8fafc");
    this.#status = this.#createText(`${input.node.id}-room-status`, 1, "#facc15");
    this.#root.add(this.#content);
    this.#root.add(this.#draft);
    this.#root.add(this.#status);
    this.#releaseRoom = this.#store.retainGlobalRoomSnapshot(this.#chatId);
    this.#releaseStore = this.#store.subscribe?.(() => this.#syncFromStore()) ?? null;
    this.syncNode(input.node);
    void this.#hydrate();
  }

  get root(): BoxRenderable {
    return this.#root;
  }

  syncNode(node: ChildLayoutNode): void {
    this.#node = node;
    this.#root.left = node.rect.x;
    this.#root.top = node.rect.y;
    this.#root.width = node.rect.width;
    this.#root.height = node.rect.height;
    this.#root.borderColor = node.focused ? "#22c55e" : "#475569";
    this.#chromeRegions = this.#chrome.sync({
      root: this.#root,
      rect: node.rect,
      state: {
        title: "Chat",
        hoveredActionId: this.#hoveredChromeAction,
        actions: [shellPaneCloseAction()],
      },
    });
    this.#renderContent();
    if (node.focused) {
      this.focus();
    }
  }

  focus(): void {
    this.#root.focus();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#releaseStore?.();
    this.#releaseRoom?.();
    this.#chrome.destroy();
    this.#root.destroyRecursively();
  }

  #handleMouseDown(event: MouseEvent): void {
    if (this.#selectionBehavior.handleMouseDown(event)) {
      this.#onFocus?.(this.#node.id);
      this.focus();
      return;
    }
    if (this.#buttonPress.handleMouseDown(event)) {
      return;
    }
    this.#onFocus?.(this.#node.id);
    this.focus();
  }

  #handleMouseUp(event: MouseEvent): void {
    if (this.#selectionBehavior.handleMouseUp(event)) {
      return;
    }
    this.#buttonPress.handleMouseUp(event);
  }

  #handleMouseMove(event: MouseEvent): void {
    this.#buttonPress.handleMouseMove(event);
  }

  handleKeypress(value: unknown): boolean {
    if (this.#disposed || !this.#node.focused) {
      return false;
    }
    const key = readKeyEvent(value);
    if (!key || key.defaultPrevented) {
      return false;
    }
    return this.#consumeKey(key);
  }

  #createText(id: string, top: number, fg: string): TextRenderable {
    return new TextRenderable(this.#renderer, {
      id,
      position: "absolute",
      left: PANE_CONTENT_ORIGIN,
      top,
      width: 1,
      height: 1,
      content: "",
      fg,
      bg: "#0f172a",
      selectable: true,
      selectionBg: "#86efac",
      selectionFg: "#052e16",
      wrapMode: "none",
    });
  }

  async #hydrate(): Promise<void> {
    try {
      const snapshot = await this.#store.hydrateGlobalRoomSnapshot({
        chatId: this.#chatId,
        accessToken: this.#accessToken,
        force: true,
      });
      if (this.#disposed) {
        return;
      }
      this.#messages = snapshot?.items ?? [];
      this.#notice = "Enter send";
      this.#renderContent();
    } catch (error) {
      if (this.#disposed) {
        return;
      }
      this.#notice = `room hydrate failed: ${error instanceof Error ? error.message : String(error)}`;
      this.#renderContent();
    }
  }

  #syncFromStore(): void {
    const messages = readSnapshotMessages(this.#store, this.#chatId);
    if (messages) {
      this.#messages = messages;
      this.#renderContent();
    }
  }

  #renderContent(): void {
    const { width, height } = resolveBorderedPaneContentSize(this.#node.rect);
    const transcriptHeight = Math.max(1, height - 3);
    const lines = [`Room: ${this.#titleText}`, ...this.#messages.map(messageText)];
    const visible = lines.slice(Math.max(0, lines.length - transcriptHeight));
    this.#content.left = PANE_CONTENT_ORIGIN;
    this.#content.top = PANE_CONTENT_ORIGIN;
    this.#content.width = width;
    this.#content.height = transcriptHeight;
    this.#content.content = visible.map((line) => line.slice(0, width)).join("\n");
    this.#draft.left = PANE_CONTENT_ORIGIN;
    this.#draft.top = Math.max(0, height - 1);
    this.#draft.width = width;
    this.#draft.height = 1;
    this.#draft.content = `> ${this.#draftText}`.slice(0, width);
    this.#status.left = PANE_CONTENT_ORIGIN;
    this.#status.top = Math.max(0, height - 2);
    this.#status.width = width;
    this.#status.height = 1;
    this.#status.content = this.#notice.slice(0, width);
    this.#renderer.requestRender();
  }

  #consumeKey(key: KeyEvent): boolean {
    if (key.name === "return") {
      key.preventDefault();
      void this.#sendDraft();
      return true;
    }
    if (key.name === "backspace") {
      key.preventDefault();
      this.#draftText = this.#draftText.slice(0, -1);
      this.#renderContent();
      return true;
    }
    if (key.name === "escape") {
      key.preventDefault();
      this.#draftText = "";
      this.#renderContent();
      return true;
    }
    const text = key.sequence || key.raw;
    if (text.length === 1 && !key.ctrl && !key.meta) {
      key.preventDefault();
      this.#draftText += text;
      this.#renderContent();
      return true;
    }
    return false;
  }

  async #sendDraft(): Promise<void> {
    const text = this.#draftText.trim();
    if (text.length === 0) {
      return;
    }
    this.#notice = "sending...";
    this.#renderContent();
    const result = await this.#store.sendGlobalRoomMessage({
      chatId: this.#chatId,
      accessToken: this.#accessToken,
      text,
    });
    if (!result.ok) {
      this.#notice = `send failed: ${result.reason ?? "unknown"}`;
      this.#renderContent();
      return;
    }
    this.#draftText = "";
    this.#messages = [
      ...this.#messages,
      {
        rowId: Date.now(),
        messageId: Date.now(),
        chatId: this.#chatId,
        sourceSystemId: "0x0000000000000000000000000000000000000000",
        from: "me",
        kind: "text",
        content: text,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        readContactIds: [],
        unreadContactIds: [],
      },
    ];
    this.#notice = "sent";
    this.#renderContent();
    void this.#hydrate();
  }
}

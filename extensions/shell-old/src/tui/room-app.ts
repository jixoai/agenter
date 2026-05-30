import type {
  GlobalRoomMessage,
  GlobalTerminalApprovalRequest,
  HistoryPageCursor,
  RuntimeClientState,
} from "@agenter/client-sdk";
import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  SelectRenderable,
  SelectRenderableEvents,
  ScrollBoxRenderable,
  TextareaRenderable,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type SelectOption,
  type MouseEvent,
} from "@opentui/core";

import type { CliShellRoomBootstrapResult } from "../bootstrap";
import {
  buildCliShellTextareaKeyBindings,
  matchesCliShellComposerBinding,
  matchesCliShellPanelBinding,
  matchesCliShellTextareaBinding,
  resolveCliShellComposerSlashCommands,
} from "./room-keybindings";
import { readSystemClipboardText } from "./system-clipboard";
import type {
  CliShellComposerMode,
  CliShellConfirmPanelState,
  CliShellHistoryItem,
  CliShellHistoryPanelState,
  CliShellTextareaState,
} from "./composer-types";
import { resolvePendingTerminalApproval } from "./approval-model";
import { buildCliShellRoomRows, padCliShellRoomText, type CliShellRoomRenderRow } from "./room-model";
import type { CliShellKeybindings, CliShellSettings } from "./settings";

export interface CliShellRoomAppInput {
  store: CliShellRoomAppStore;
  shellName: string;
  attached: CliShellRoomBootstrapResult;
  settings?: CliShellSettings;
  keybindings?: CliShellKeybindings;
  renderer?: CliRenderer;
  onQuit?: () => void;
  onLayoutRequest?: (mode: CliShellRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  onTopLayerRequest?: () => void | Promise<void>;
}

export interface CliShellRoomAppStore {
  getState(): Pick<RuntimeClientState, "globalRoomSnapshotsById" | "globalTerminalApprovalsById">;
  subscribe(listener: () => void): () => void;
  retainGlobalRoomSnapshot(chatId: string): () => void;
  retainTerminalPermissionRequests(input?: { terminalId?: string }): () => void;
  hydrateGlobalRoomSnapshot(input: {
    chatId: string;
    accessToken?: string;
    limit?: number;
    force?: boolean;
  }): Promise<{ items: GlobalRoomMessage[] } | null>;
  sendGlobalRoomMessage(input: {
    chatId: string;
    accessToken?: string;
    text: string;
  }): Promise<{ ok: boolean; reason?: string }>;
  pageGlobalRoomMessages(input: {
    chatId: string;
    accessToken?: string;
    before?: HistoryPageCursor | null;
    limit?: number;
  }): Promise<{
    items: GlobalRoomMessage[];
    hasMore: boolean;
    nextBefore: HistoryPageCursor | null;
    roomRevision: string;
    transcriptRevision: string;
    headVersion: string;
  }>;
  hydrateGlobalTerminalApprovals(input: { terminalId: string; force?: boolean }): Promise<GlobalTerminalApprovalRequest[]>;
  approveGlobalTerminalRequest(input: { terminalId: string; requestId: string; durationMs: number }): Promise<unknown>;
  denyGlobalTerminalRequest(input: { terminalId: string; requestId: string }): Promise<unknown>;
}

const ROOM_SCROLL_BOTTOM = Number.MAX_SAFE_INTEGER;
export type CliShellRoomLayoutMode = "left" | "right" | "cover";
export interface CliShellRoomLayoutRequestResult {
  closeCurrentSurface: boolean;
}

interface RoomActionRegion {
  action: "close" | "layout-left" | "layout-right" | "layout-cover";
  row: number;
  col: number;
  width: number;
}

interface HistoryInsertPendingSelection {
  item: CliShellHistoryItem;
}

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

const resolveRoomMessages = (state: Pick<RuntimeClientState, "globalRoomSnapshotsById">, chatId: string): GlobalRoomMessage[] =>
  state.globalRoomSnapshotsById[chatId]?.data?.items ?? [];

const rowSignature = (rows: readonly CliShellRoomRenderRow[]): string =>
  rows.map((row) => `${row.key}\u0000${row.plainText}`).join("\u0001");

const layoutModeTitle = (mode: CliShellRoomLayoutMode): string => {
  if (mode === "left") {
    return "left";
  }
  if (mode === "right") {
    return "right";
  }
  return "cover";
};

export class CliShellRoomApp {
  readonly #input: CliShellRoomAppInput;
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #root: BoxRenderable;
  readonly #titleLine: TextRenderable;
  readonly #scrollBox: ScrollBoxRenderable;
  readonly #statusLine: TextRenderable;
  readonly #draftPrompt: TextRenderable;
  readonly #draftInput: TextareaRenderable;
  readonly #historyPanel: SelectRenderable;
  readonly #confirmTitle: TextRenderable;
  readonly #confirmMessage: TextRenderable;
  readonly #confirmActions: TextRenderable;
  #state: Pick<RuntimeClientState, "globalRoomSnapshotsById" | "globalTerminalApprovalsById">;
  #releaseStore: (() => void) | null = null;
  #releaseRoom: (() => void) | null = null;
  #releasePermissionRequests: (() => void) | null = null;
  #statusNotice: string | null = null;
  #scrollTop = ROOM_SCROLL_BOTTOM;
  #renderedRows = new Map<string, TextRenderable>();
  #rowsSignature = "";
  #actionRegions: RoomActionRegion[] = [];
  #lastTopLayerRequestKey: string | null = null;
  #disposed = false;
  #composerMode: CliShellComposerMode = "textarea";
  #textareaState: CliShellTextareaState = { value: "", selection: null };
  #historyPanelState: CliShellHistoryPanelState = {
    items: [],
    selectedIndex: 0,
    loading: false,
    hasMoreBefore: false,
  };
  #historyNextBefore: HistoryPageCursor | null = null;
  #confirmState: CliShellConfirmPanelState | null = null;
  #pendingHistoryInsert: HistoryInsertPendingSelection | null = null;
  readonly #settings: CliShellSettings | undefined;
  readonly #keybindings: CliShellKeybindings | undefined;

  constructor(input: CliShellRoomAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#state = input.store.getState();
    this.#settings = input.settings;
    this.#keybindings = input.keybindings;
    this.#root = new BoxRenderable(this.#renderer, {
      id: "cli-shell-room-root",
      width: "100%",
      height: "100%",
      position: "absolute",
      top: 0,
      left: 0,
      backgroundColor: "#101820",
    });
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#titleLine = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-title",
      position: "absolute",
      top: 0,
      left: 0,
      width: Math.max(1, this.#renderer.width),
      height: 1,
      content: "",
      bg: "#0f172a",
      fg: "#cbd5e1",
    });
    this.#scrollBox = new ScrollBoxRenderable(this.#renderer, {
      id: "cli-shell-room-scrollbox",
      position: "absolute",
      top: 1,
      left: 0,
      width: Math.max(1, this.#renderer.width),
      height: Math.max(1, this.#renderer.height - 3),
      scrollY: true,
      scrollX: false,
      stickyScroll: true,
      stickyStart: "bottom",
      scrollbarOptions: {
        showArrows: false,
      },
    });
    this.#scrollBox.onMouseScroll = (event) => this.#syncScrollFromHost(event);
    this.#scrollBox.verticalScrollBar.on("change", () => this.#syncScrollFromHost());
    this.#statusLine = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-status",
      position: "absolute",
      left: 0,
      top: Math.max(0, this.#renderer.height - 2),
      width: Math.max(1, this.#renderer.width),
      height: 1,
      content: "",
      bg: "#0f172a",
      fg: "#cbd5e1",
    });
    this.#draftPrompt = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-draft-prompt",
      position: "absolute",
      left: 0,
      top: Math.max(0, this.#renderer.height - 1),
      width: 2,
      height: 1,
      content: "> ",
      bg: "#101820",
      fg: "#94a3b8",
    });
    this.#draftInput = new TextareaRenderable(this.#renderer, {
      id: "cli-shell-room-draft",
      position: "absolute",
      left: 2,
      top: Math.max(0, this.#renderer.height - 1),
      width: Math.max(1, this.#renderer.width),
      height: 3,
      backgroundColor: "#111827",
      textColor: "#f8fafc",
      focusedBackgroundColor: "#111827",
      focusedTextColor: "#f8fafc",
      cursorColor: "#facc15",
      placeholder: "message",
      keyBindings: buildCliShellTextareaKeyBindings(this.#keybindings),
      onSubmit: () => {
        void this.#submitDraft();
      },
    });
    this.#historyPanel = new SelectRenderable(this.#renderer, {
      id: "cli-shell-room-history",
      position: "absolute",
      left: 2,
      top: Math.max(0, this.#renderer.height - 3),
      width: Math.max(1, this.#renderer.width - 2),
      height: 3,
      showDescription: false,
      showScrollIndicator: true,
      wrapSelection: false,
      options: [],
    });
    this.#historyPanel.on(SelectRenderableEvents.ITEM_SELECTED, () => {
      this.#selectHistoryItem();
    });
    this.#confirmTitle = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-confirm-title",
      position: "absolute",
      left: 2,
      top: Math.max(0, this.#renderer.height - 3),
      width: Math.max(1, this.#renderer.width - 2),
      height: 1,
      content: "",
      bg: "#111827",
      fg: "#f8fafc",
    });
    this.#confirmMessage = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-confirm-message",
      position: "absolute",
      left: 2,
      top: Math.max(0, this.#renderer.height - 2),
      width: Math.max(1, this.#renderer.width - 2),
      height: 1,
      content: "",
      bg: "#111827",
      fg: "#cbd5e1",
    });
    this.#confirmActions = new TextRenderable(this.#renderer, {
      id: "cli-shell-room-confirm-actions",
      position: "absolute",
      left: 2,
      top: Math.max(0, this.#renderer.height - 1),
      width: Math.max(1, this.#renderer.width - 2),
      height: 1,
      content: "",
      bg: "#111827",
      fg: "#f8fafc",
    });
    this.#root.add(this.#titleLine);
    this.#root.add(this.#scrollBox);
    this.#root.add(this.#statusLine);
    this.#root.add(this.#draftPrompt);
    this.#root.add(this.#draftInput);
    this.#root.add(this.#historyPanel);
    this.#root.add(this.#confirmTitle);
    this.#root.add(this.#confirmMessage);
    this.#root.add(this.#confirmActions);
    this.#renderer.root.add(this.#root);
    this.#draftInput.onContentChange = () => {
      this.#textareaState.value = this.#draftInput.plainText;
      this.#textareaState.selection = this.#draftInput.getSelection();
      this.#statusNotice = null;
      this.render("draft-input");
    };
    this.#draftInput.onCursorChange = () => {
      this.#textareaState.selection = this.#draftInput.getSelection();
    };
    this.#draftInput.focus();
  }

  start(): void {
    if (this.#disposed) {
      return;
    }
    this.#releaseStore = this.#input.store.subscribe(() => {
      this.#state = this.#input.store.getState();
      this.#requestTopLayerForPendingApproval();
      this.render("store-update");
    });
    this.#releaseRoom = this.#input.store.retainGlobalRoomSnapshot(this.#input.attached.room.entry.chatId);
    this.#releasePermissionRequests = this.#input.store.retainTerminalPermissionRequests({
      terminalId: this.#input.attached.terminal.entry.terminalId,
    });
    this.#requestTopLayerForPendingApproval();
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    void this.#input.store
      .hydrateGlobalRoomSnapshot({
        chatId: this.#input.attached.room.entry.chatId,
        accessToken: this.#input.attached.room.entry.accessToken,
        force: true,
      })
      .then(() => {
        this.#state = this.#input.store.getState();
        this.render("hydrate");
      })
      .catch((error: unknown) => {
        this.#statusNotice = `room hydrate failed: ${error instanceof Error ? error.message : String(error)}`;
        this.render("hydrate-error");
      });
    this.render("start");
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
    this.#releasePermissionRequests?.();
    this.#releasePermissionRequests = null;
    this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
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
    const height = Math.max(3, this.#renderer.height);
    const composerHeight = this.#composerMode === "textarea" ? 3 : 3;
    const bodyHeight = Math.max(1, height - composerHeight - 2);
    this.#actionRegions = [];
    this.#root.width = width;
    this.#root.height = height;
    this.#titleLine.left = 0;
    this.#titleLine.width = width;
    this.#scrollBox.left = 0;
    this.#scrollBox.width = width;
    this.#scrollBox.height = bodyHeight;
    this.#statusLine.left = 0;
    this.#statusLine.top = Math.max(0, height - composerHeight - 1);
    this.#statusLine.width = width;
    this.#draftPrompt.left = 0;
    this.#draftPrompt.top = Math.max(0, height - composerHeight);
    this.#draftInput.left = 2;
    this.#draftInput.top = Math.max(0, height - composerHeight);
    this.#draftInput.width = Math.max(1, width - 2);
    this.#draftInput.height = composerHeight;
    this.#historyPanel.left = 2;
    this.#historyPanel.top = Math.max(0, height - composerHeight);
    this.#historyPanel.width = Math.max(1, width - 2);
    this.#historyPanel.height = composerHeight;
    this.#confirmTitle.left = 2;
    this.#confirmTitle.top = Math.max(0, height - composerHeight);
    this.#confirmTitle.width = Math.max(1, width - 2);
    this.#confirmMessage.left = 2;
    this.#confirmMessage.top = Math.max(0, height - composerHeight + 1);
    this.#confirmMessage.width = Math.max(1, width - 2);
    this.#confirmActions.left = 2;
    this.#confirmActions.top = Math.max(0, height - 1);
    this.#confirmActions.width = Math.max(1, width - 2);

    const rows = buildCliShellRoomRows({
      messages: resolveRoomMessages(this.#state, this.#input.attached.room.entry.chatId),
      avatarActorId: this.#input.attached.avatarActorId,
      width: Math.max(1, width - 3),
    });
    this.#renderTitle(width);
    this.#renderRows(rows, width);
    this.#syncScrollTop(this.#scrollTop);
    this.#statusLine.content = this.#formatStatusLine(width);
    this.#draftPrompt.content = "> ";
    this.#syncComposerSurface(width);
    this.#renderer.requestRender();
  }

  #renderTitle(width: number): void {
    const controls = [
      { action: "close" as const, label: "[x]" },
      { action: "layout-left" as const, label: " ◨ " },
      { action: "layout-right" as const, label: " ◧ " },
      { action: "layout-cover" as const, label: " ⿴ " },
    ];
    let content = " Chat ";
    for (const control of controls) {
      const titleLeft = typeof this.#titleLine.left === "number" ? this.#titleLine.left : 0;
      const col = Bun.stringWidth(content);
      this.#actionRegions.push({
        action: control.action,
        row: 0,
        col: titleLeft + col,
        width: Bun.stringWidth(control.label),
      });
      content += control.label;
    }
    this.#titleLine.content = padCliShellRoomText(content, width);
  }

  #renderRows(rows: readonly CliShellRoomRenderRow[], width: number): void {
    const signature = rowSignature(rows);
    if (signature === this.#rowsSignature) {
      return;
    }
    this.#rowsSignature = signature;

    const liveKeys = new Set<string>();
    rows.forEach((row, index) => {
      liveKeys.add(row.key);
      const content =
        typeof row.content === "string"
          ? padCliShellRoomText(row.content, width)
          : row.content;
      let renderable = this.#renderedRows.get(row.key);
      if (!renderable) {
        renderable = new TextRenderable(this.#renderer, {
          id: `cli-shell-room-row-${row.key}`,
          width: "100%",
          height: 1,
          content,
          bg: "#101820",
          fg: "#e5e7eb",
        });
        this.#renderedRows.set(row.key, renderable);
      } else {
        renderable.content = content;
      }
      if (this.#scrollBox.getChildren()[index] !== renderable) {
        this.#scrollBox.add(renderable, index);
      }
    });

    for (const [key, renderable] of this.#renderedRows) {
      if (!liveKeys.has(key)) {
        this.#scrollBox.remove(renderable.id);
        this.#renderedRows.delete(key);
      }
    }
  }

  #syncScrollTop(scrollTop: number): void {
    const maxScrollTop = Math.max(0, this.#scrollBox.scrollHeight - this.#scrollBox.viewport.height);
    const shouldStick = scrollTop >= ROOM_SCROLL_BOTTOM;
    this.#scrollTop = shouldStick ? ROOM_SCROLL_BOTTOM : Math.max(0, Math.min(maxScrollTop, Math.trunc(scrollTop)));
    this.#scrollBox.stickyScroll = shouldStick;
    this.#scrollBox.stickyStart = "bottom";
    this.#scrollBox.scrollTop = shouldStick ? maxScrollTop : this.#scrollTop;
  }

  #syncScrollFromHost(_event?: MouseEvent): void {
    const maxScrollTop = Math.max(0, this.#scrollBox.scrollHeight - this.#scrollBox.viewport.height);
    const nextScrollTop = Math.max(0, Math.min(maxScrollTop, Math.trunc(this.#scrollBox.scrollTop)));
    this.#scrollTop = maxScrollTop - nextScrollTop <= 1 ? ROOM_SCROLL_BOTTOM : nextScrollTop;
    this.#statusNotice = null;
    this.render("scroll");
  }

  #formatStatusLine(width: number): string {
    const text =
      this.#statusNotice?.trim() ||
      `${this.#input.shellName} room | @${this.#input.attached.avatar.nickname} | Enter send | /history | Esc/Ctrl+Q quit`;
    return padCliShellRoomText(text, width);
  }

  #syncComposerSurface(width: number): void {
    this.#draftInput.visible = this.#composerMode === "textarea";
    this.#historyPanel.visible = this.#composerMode === "panel";
    this.#confirmTitle.visible = this.#composerMode === "confirm";
    this.#confirmMessage.visible = this.#composerMode === "confirm";
    this.#confirmActions.visible = this.#composerMode === "confirm";

    if (this.#composerMode === "textarea") {
      return;
    }
    if (this.#composerMode === "panel") {
      const options: SelectOption[] = this.#historyPanelState.items.map((item) => ({
        name: padCliShellRoomText(item.text, width - 2),
        description: item.senderLabel,
        value: item,
      }));
      this.#historyPanel.options = options;
      this.#historyPanel.selectedIndex = Math.max(
        0,
        Math.min(this.#historyPanelState.selectedIndex, Math.max(0, options.length - 1)),
      );
      return;
    }
    if (this.#composerMode === "confirm" && this.#confirmState) {
      this.#confirmTitle.content = padCliShellRoomText(this.#confirmState.title, width - 2);
      this.#confirmMessage.content = padCliShellRoomText(this.#confirmState.message, width - 2);
      this.#confirmActions.content = padCliShellRoomText(
        `[Enter] ${this.#confirmState.confirmLabel}  [Esc] ${this.#confirmState.alternateLabel}`,
        width - 2,
      );
    }
  }

  #handleResize = (): void => {
    this.render("resize");
  };

  #focusDraftLater(): void {
    queueMicrotask(() => {
      if (this.#disposed || this.#composerMode !== "textarea") {
        return;
      }
      this.#draftInput.focus();
    });
  }

  #handleMouseDown(event: MouseEvent): void {
    const region = this.#actionRegions.find(
      (candidate) =>
        Math.trunc(event.y) === candidate.row &&
        Math.trunc(event.x) >= candidate.col &&
        Math.trunc(event.x) < candidate.col + candidate.width,
    );
    if (!region) {
      if (event.type === "down" && event.button === 0) {
        event.preventDefault();
        this.#draftInput.focus();
      }
      return;
    }
    event.preventDefault();
    if (region.action === "close") {
      this.#input.onQuit?.();
      return;
    }
    if (region.action === "layout-left") {
      this.#requestTmuxLayout("left");
      return;
    }
    if (region.action === "layout-right") {
      this.#requestTmuxLayout("right");
      return;
    }
    if (region.action === "layout-cover") {
      this.#requestTmuxLayout("cover");
      return;
    }
  }

  #handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    if (this.#composerMode === "panel" && matchesCliShellPanelBinding(this.#keybindings, "cancel", key)) {
      key.preventDefault();
      this.#composerMode = "textarea";
      this.#focusDraftLater();
      this.render("history-cancel");
      return;
    }
    if (this.#composerMode === "confirm" && matchesCliShellPanelBinding(this.#keybindings, "cancel", key)) {
      key.preventDefault();
      this.#confirmKeepAndInsert();
      return;
    }
    if (this.#composerMode === "confirm" && matchesCliShellPanelBinding(this.#keybindings, "confirm", key)) {
      key.preventDefault();
      this.#confirmReplaceDraft();
      return;
    }
    if ((key.ctrl && key.name === "q") || key.name === "escape") {
      if (this.#composerMode === "panel") {
        key.preventDefault();
        this.#composerMode = "textarea";
        this.#focusDraftLater();
        this.render("history-cancel");
        return;
      }
      if (this.#composerMode === "confirm") {
        key.preventDefault();
        this.#confirmKeepAndInsert();
        return;
      }
      key.preventDefault();
      this.#input.onQuit?.();
      return;
    }
    if (key.ctrl && key.name === "left") {
      key.preventDefault();
      this.#requestTmuxLayout("left");
      return;
    }
    if (key.ctrl && key.name === "right") {
      key.preventDefault();
      this.#requestTmuxLayout("right");
      return;
    }
    if (key.ctrl && key.name === "up") {
      key.preventDefault();
      this.#requestTmuxLayout("cover");
      return;
    }
    if (key.name === "up" || key.name === "down") {
      if (this.#composerMode === "textarea") {
        return;
      }
      key.preventDefault();
      if (this.#composerMode === "panel") {
        if (key.name === "up") {
          this.#historyPanel.moveUp();
        } else {
          this.#historyPanel.moveDown();
        }
        this.#historyPanelState.selectedIndex = this.#historyPanel.getSelectedIndex();
        this.render("history-nav");
      }
      return;
    }
    if (this.#composerMode === "textarea" && matchesCliShellTextareaBinding(this.#keybindings, "copy", key)) {
      key.preventDefault();
      this.#copyDraftSelection();
      return;
    }
    if (this.#composerMode === "textarea" && matchesCliShellTextareaBinding(this.#keybindings, "paste", key)) {
      key.preventDefault();
      void this.#pasteClipboardText();
      return;
    }
    if (this.#composerMode === "textarea" && matchesCliShellComposerBinding(this.#keybindings, "history", key)) {
      key.preventDefault();
      void this.#openHistoryPanel();
      return;
    }
    if (this.#composerMode === "confirm" && key.name === "return") {
      key.preventDefault();
      this.#confirmReplaceDraft();
      return;
    }
  };

  #requestTmuxLayout(mode: CliShellRoomLayoutMode): void {
    if (!this.#input.onLayoutRequest) {
      this.#statusNotice = "tmux layout controls are available inside cli-shell host";
      this.render(`layout-${mode}-unavailable`);
      return;
    }
    this.#statusNotice = `switching tmux Chat layout to ${layoutModeTitle(mode)}...`;
    this.render(`layout-${mode}-request`);
    try {
      const result = this.#input.onLayoutRequest(mode);
      void Promise.resolve(result)
        .then((requestResult) => {
          if (requestResult === undefined || requestResult.closeCurrentSurface) {
            this.#input.onQuit?.();
          }
        })
        .catch((error: unknown) => {
          this.#statusNotice = `layout request failed: ${error instanceof Error ? error.message : String(error)}`;
          this.render(`layout-${mode}-error`);
        });
    } catch (error) {
      this.#statusNotice = `layout request failed: ${error instanceof Error ? error.message : String(error)}`;
      this.render(`layout-${mode}-error`);
    }
  }

  async #submitDraft(): Promise<void> {
    const draftText = this.#draftInput.plainText;
    const normalizedText = draftText.trim();
    if (normalizedText.length === 0) {
      return;
    }
    if (resolveCliShellComposerSlashCommands(this.#keybindings, "history").includes(normalizedText)) {
      this.#draftInput.setText("");
      this.#textareaState.value = "";
      this.#textareaState.selection = null;
      await this.#openHistoryPanel();
      return;
    }
    this.#statusNotice = "sending room message...";
    this.render("send-start");
    try {
      const result = await this.#input.store.sendGlobalRoomMessage({
        chatId: this.#input.attached.room.entry.chatId,
        accessToken: this.#input.attached.room.entry.accessToken,
        text: draftText,
      });
      if (!result.ok) {
        throw new Error(result.reason ?? "message send failed");
      }
      this.#draftInput.setText("");
      this.#textareaState.value = "";
      this.#textareaState.selection = null;
      this.#focusDraftLater();
      this.#scrollTop = ROOM_SCROLL_BOTTOM;
      this.#statusNotice = "message sent";
      this.render("send-finished");
      await this.#input.store.hydrateGlobalRoomSnapshot({
        chatId: this.#input.attached.room.entry.chatId,
        accessToken: this.#input.attached.room.entry.accessToken,
        force: true,
      }).catch((error: unknown) => {
        this.#statusNotice = `message sent; refresh failed: ${error instanceof Error ? error.message : String(error)}`;
        this.render("send-refresh-error");
      });
    } catch (error) {
      this.#statusNotice = `message send failed: ${error instanceof Error ? error.message : String(error)}`;
      this.render("send-error");
    }
  }

  #requestTopLayerForPendingApproval(): void {
    const request = resolvePendingTerminalApproval(this.#state, this.#input.attached.terminal.entry.terminalId);
    if (!request) {
      this.#lastTopLayerRequestKey = null;
      return;
    }
    const key = `${request.terminalId}:${request.requestId}`;
    if (this.#lastTopLayerRequestKey === key) {
      return;
    }
    this.#lastTopLayerRequestKey = key;
    try {
      void Promise.resolve(this.#input.onTopLayerRequest?.()).catch((error: unknown) => {
        this.#statusNotice = `top layer request failed: ${error instanceof Error ? error.message : String(error)}`;
        this.render("top-layer-error");
      });
    } catch (error) {
      this.#statusNotice = `top layer request failed: ${error instanceof Error ? error.message : String(error)}`;
      this.render("top-layer-error");
    }
  }

  async #openHistoryPanel(): Promise<void> {
    this.#composerMode = "panel";
    this.#historyPanelState = {
      items: [],
      selectedIndex: 0,
      loading: true,
      hasMoreBefore: false,
    };
    this.#historyNextBefore = null;
    this.render("history-open");
    try {
      const page = await this.#input.store.pageGlobalRoomMessages({
        chatId: this.#input.attached.room.entry.chatId,
        accessToken: this.#input.attached.room.entry.accessToken,
        limit: 20,
      });
      this.#historyPanelState = {
        items: page.items.map((item) => ({
          rowId: item.rowId,
          messageId: item.messageId,
          text: item.content,
          senderLabel: item.from,
        })),
        selectedIndex: 0,
        loading: false,
        hasMoreBefore: page.hasMore,
      };
      this.#historyNextBefore = page.nextBefore;
      this.#historyPanel.focus();
      this.render("history-ready");
    } catch (error) {
      this.#composerMode = "textarea";
      this.#focusDraftLater();
      this.#statusNotice = `history load failed: ${error instanceof Error ? error.message : String(error)}`;
      this.render("history-error");
    }
  }

  #selectHistoryItem(): void {
    const selected = this.#historyPanel.getSelectedOption()?.value as CliShellHistoryItem | undefined;
    if (!selected) {
      return;
    }
    if (this.#draftInput.plainText.trim().length === 0) {
      this.#insertHistoryText(selected.text, false);
      return;
    }
    this.#pendingHistoryInsert = { item: selected };
    this.#confirmState = {
      title: "Replace current draft?",
      message: "Enter replaces the draft. Esc keeps the draft and inserts at the cursor.",
      confirmLabel: "replace draft",
      alternateLabel: "insert at cursor",
    };
    this.#composerMode = "confirm";
    this.render("history-confirm");
  }

  #confirmReplaceDraft(): void {
    const selected = this.#pendingHistoryInsert;
    if (!selected) {
      this.#composerMode = "textarea";
      this.#focusDraftLater();
      this.render("confirm-empty");
      return;
    }
    this.#insertHistoryText(selected.item.text, true);
  }

  #confirmKeepAndInsert(): void {
    const selected = this.#pendingHistoryInsert;
    if (!selected) {
      this.#composerMode = "textarea";
      this.#focusDraftLater();
      this.render("confirm-empty");
      return;
    }
    this.#insertHistoryText(selected.item.text, false);
  }

  #insertHistoryText(text: string, replace: boolean): void {
    this.#composerMode = "textarea";
    this.#pendingHistoryInsert = null;
    this.#confirmState = null;
    this.#focusDraftLater();
    if (replace) {
      this.#draftInput.replaceText(text);
      this.#draftInput.cursorOffset = text.length;
    } else {
      const selection = this.#draftInput.getSelection();
      const insertOffset = selection?.end ?? this.#draftInput.cursorOffset;
      this.#draftInput.setSelection(insertOffset, insertOffset);
      this.#draftInput.insertText(text);
      this.#draftInput.cursorOffset = insertOffset + text.length;
    }
    this.#textareaState.value = this.#draftInput.plainText;
    this.#textareaState.selection = this.#draftInput.getSelection();
    this.render(replace ? "history-replace" : "history-insert");
  }

  #copyDraftSelection(): void {
    const selectedText = this.#draftInput.getSelectedText();
    if (selectedText.length === 0) {
      return;
    }
    this.#renderer.copyToClipboardOSC52(selectedText);
    this.#statusNotice = "copied selection";
    this.render("copy-selection");
  }

  async #pasteClipboardText(): Promise<void> {
    const text = await readSystemClipboardText();
    if (!text || text.length === 0) {
      this.#statusNotice = "clipboard is empty";
      this.render("paste-empty");
      return;
    }
    this.#draftInput.insertText(text);
    this.#textareaState.value = this.#draftInput.plainText;
    this.#textareaState.selection = this.#draftInput.getSelection();
    this.render("paste-clipboard");
  }
}

export const startCliShellRoomApp = async (
  input: CliShellRoomAppInput,
): Promise<{ app: CliShellRoomApp; renderer: CliRenderer }> => {
  const renderer = input.renderer ?? (await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
    useKittyKeyboard: { events: true },
  }));
  const app = new CliShellRoomApp({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return { app, renderer };
};

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
  type Renderable,
  ScrollBoxRenderable,
  SelectRenderable,
  SelectRenderableEvents,
  TextareaRenderable,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
  type SelectOption,
} from "@opentui/core";

import type { ShellRoomBootstrapResult } from "../product/bootstrap";
import {
  createShellRendererSelectionBehavior,
  type ShellRendererSelectionBehavior,
} from "../renderable-mux/renderer-selection";
import { ShellButtonPressController } from "../renderable-mux/button-press-controller";
import {
  ShellPaneChromeController,
  resolveShellPaneChromeClick,
  shellPaneButtonLabel,
  shellPaneCloseAction,
  syncShellPaneChrome,
  type ShellPaneChromeHitRegion,
  type ShellPaneTitleAction,
  type ShellPaneTitleActionId,
} from "../renderable-mux/pane-chrome";
import { resolvePendingTerminalApproval } from "./approval-model";
import type {
  ShellComposerMode,
  ShellConfirmPanelState,
  ShellHistoryItem,
  ShellHistoryPanelState,
  ShellTextareaState,
} from "./composer-types";
import {
  buildShellTextareaKeyBindings,
  matchesShellComposerBinding,
  matchesShellPanelBinding,
  matchesShellTextareaBinding,
  resolveShellComposerSlashCommands,
} from "./room-keybindings";
import { buildShellRoomRows, padShellRoomText, type ShellRoomRenderRow } from "./room-model";
import type { ShellKeybindings, ShellSettings } from "./settings";
import { readSystemClipboardText } from "./system-clipboard";

export interface ShellRoomAppInput {
  store: ShellRoomAppStore;
  shellName: string;
  attached: ShellRoomBootstrapResult;
  settings?: ShellSettings;
  keybindings?: ShellKeybindings;
  renderer?: CliRenderer;
  mountRoot?: boolean;
  hostNode?: ShellRoomHostNode;
  hostChrome?: ShellRoomHostChrome;
  onHostFocus?: (paneId: string) => void;
  onQuit?: () => void;
  onLayoutRequest?: (mode: ShellRoomLayoutMode) => void | Promise<void | { closeCurrentSurface: boolean }>;
  onTopLayerRequest?: () => void | Promise<void>;
}

export interface ShellRoomHostNode {
  id: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  focused: boolean;
}

export interface ShellRoomHostChrome {
  title: string;
  actions?: readonly ShellRoomHostChromeAction[];
  layoutMode?: ShellRoomLayoutMode;
}

export interface ShellRoomAppStore {
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
  hydrateGlobalTerminalApprovals(input: {
    terminalId: string;
    force?: boolean;
  }): Promise<GlobalTerminalApprovalRequest[]>;
  approveGlobalTerminalRequest(input: { terminalId: string; requestId: string; durationMs: number }): Promise<unknown>;
  denyGlobalTerminalRequest(input: { terminalId: string; requestId: string }): Promise<unknown>;
}

const ROOM_SCROLL_BOTTOM = Number.MAX_SAFE_INTEGER;
export type ShellRoomLayoutMode = "left" | "right" | "float";
export type ShellRoomHostChromeAction = "close" | "layout-left" | "layout-right" | "layout-float";

export interface ShellRoomLayoutRequestResult {
  closeCurrentSurface: boolean;
}

interface RoomActionRegion {
  action: ShellRoomHostChromeAction;
  row: number;
  col: number;
  width: number;
}

interface HistoryInsertPendingSelection {
  item: ShellHistoryItem;
}

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

const resolveRoomMessages = (
  state: Pick<RuntimeClientState, "globalRoomSnapshotsById">,
  chatId: string,
): GlobalRoomMessage[] => state.globalRoomSnapshotsById[chatId]?.data?.items ?? [];

const rowSignature = (rows: readonly ShellRoomRenderRow[]): string =>
  rows.map((row) => `${row.key}\u0000${row.plainText}`).join("\u0001");

const layoutModeTitle = (mode: ShellRoomLayoutMode): string => {
  if (mode === "left") {
    return "left";
  }
  if (mode === "right") {
    return "right";
  }
  return "float";
};

const defaultRoomChromeActions = ["layout-left", "layout-right", "layout-float", "close"] as const;

const roomChromeActionToTitleAction = (
  action: ShellRoomHostChromeAction,
  layoutMode?: ShellRoomLayoutMode,
): ShellPaneTitleAction => {
  if (action === "close") {
    return shellPaneCloseAction();
  }
  if (action === "layout-left") {
    const active = layoutMode === "left";
    return {
      id: action,
      label: shellPaneButtonLabel("←"),
      active,
    };
  }
  if (action === "layout-right") {
    const active = layoutMode === "right";
    return {
      id: action,
      label: shellPaneButtonLabel("→"),
      active,
    };
  }
  const active = layoutMode === "float";
  return {
    id: action,
    label: shellPaneButtonLabel("⿻"),
    active,
  };
};

const roomChromeActionToLayoutMode = (action: ShellPaneTitleActionId | null): ShellRoomLayoutMode | null => {
  if (action === "layout-left") {
    return "left";
  }
  if (action === "layout-right") {
    return "right";
  }
  if (action === "layout-float") {
    return "float";
  }
  return null;
};

export class ShellRoomApp {
  readonly #input: ShellRoomAppInput;
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
  readonly #hostChromeController: ShellPaneChromeController;
  readonly #buttonPress: ShellButtonPressController<ShellRoomHostChromeAction>;
  readonly #selectionBehavior: ShellRendererSelectionBehavior;
  #state: Pick<RuntimeClientState, "globalRoomSnapshotsById" | "globalTerminalApprovalsById">;
  #releaseStore: (() => void) | null = null;
  #releaseRoom: (() => void) | null = null;
  #releasePermissionRequests: (() => void) | null = null;
  #statusNotice: string | null = null;
  #scrollTop = ROOM_SCROLL_BOTTOM;
  #renderedRows = new Map<string, TextRenderable>();
  #rowsSignature = "";
  #actionRegions: RoomActionRegion[] = [];
  #chromeRegions: readonly ShellPaneChromeHitRegion[] = [];
  #hostChrome: ShellRoomHostChrome | undefined;
  #hoveredChromeAction: string | null = null;
  #lastTopLayerRequestKey: string | null = null;
  #disposed = false;
  #hostNode: ShellRoomHostNode | null;
  #composerMode: ShellComposerMode = "textarea";
  #textareaState: ShellTextareaState = { value: "", selection: null };
  #historyPanelState: ShellHistoryPanelState = {
    items: [],
    selectedIndex: 0,
    loading: false,
    hasMoreBefore: false,
  };
  #historyNextBefore: HistoryPageCursor | null = null;
  #confirmState: ShellConfirmPanelState | null = null;
  #pendingHistoryInsert: HistoryInsertPendingSelection | null = null;
  readonly #settings: ShellSettings | undefined;
  readonly #keybindings: ShellKeybindings | undefined;

  constructor(input: ShellRoomAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#state = input.store.getState();
    this.#settings = input.settings;
    this.#keybindings = input.keybindings;
    this.#hostNode = input.hostNode ?? null;
    this.#hostChrome = input.hostChrome;
    this.#selectionBehavior = createShellRendererSelectionBehavior({
      renderer: this.#renderer,
      // Only transcript/status text opts into semantic mouse selection here.
      // The draft editor keeps plain renderer drag-selection until we intentionally
      // add a wrapped-editor-specific selection policy.
      resolveTargets: () => [
        ...Array.from(this.#renderedRows.values(), (renderable) => ({
          renderable,
          resolveLocalPoint: (event: Pick<MouseEvent, "x" | "y">) => ({
            row: 0,
            col: Math.trunc(event.x) - renderable.screenX,
            selectionY: Math.trunc(event.y),
          }),
        })),
        { renderable: this.#statusLine },
        { renderable: this.#confirmTitle },
        { renderable: this.#confirmMessage },
      ],
    });
    this.#buttonPress = new ShellButtonPressController({
      resolveAction: (event) => this.#resolveMouseAction(event),
      onClick: (action, event) => {
        event.preventDefault();
        this.#commitMouseAction(action);
      },
      onHoverChange: (action) => {
        const hoveredChromeAction = defaultRoomChromeActions.includes(action as ShellRoomHostChromeAction)
          ? action
          : null;
        if (hoveredChromeAction === this.#hoveredChromeAction) {
          return;
        }
        this.#hoveredChromeAction = hoveredChromeAction;
        this.render("chrome-hover");
      },
    });
    this.#hostChromeController = new ShellPaneChromeController({
      renderer: this.#renderer,
      id: "shell-room-host-chrome",
      bg: "#101820",
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseUp: (event) => this.#handleMouseUp(event),
      onMouseMove: (event) => this.#handleMouseMove(event),
    });
    this.#root = new BoxRenderable(this.#renderer, {
      id: "shell-room-root",
      width: "100%",
      height: "100%",
      position: "absolute",
      top: 0,
      left: 0,
      backgroundColor: "#101820",
      border: this.#hostNode !== null,
      borderStyle: "rounded",
      borderColor: this.#hostNode?.focused ? "#22c55e" : "#475569",
      focusedBorderColor: "#22c55e",
      focusable: this.#hostNode !== null,
    });
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#root.onMouseUp = (event) => this.#handleMouseUp(event);
    this.#root.onMouseMove = (event) => this.#handleMouseMove(event);
    this.#titleLine = new TextRenderable(this.#renderer, {
      id: "shell-room-title",
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
      id: "shell-room-scrollbox",
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
      id: "shell-room-status",
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
      id: "shell-room-draft-prompt",
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
      id: "shell-room-draft",
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
      keyBindings: buildShellTextareaKeyBindings(this.#keybindings),
      onSubmit: () => {
        void this.#submitDraft();
      },
    });
    this.#historyPanel = new SelectRenderable(this.#renderer, {
      id: "shell-room-history",
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
      id: "shell-room-confirm-title",
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
      id: "shell-room-confirm-message",
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
      id: "shell-room-confirm-actions",
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
    if (input.mountRoot !== false) {
      this.#renderer.root.add(this.#root);
    }
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

  get root(): BoxRenderable {
    return this.#root;
  }

  syncHostNode(node: ShellRoomHostNode): void {
    this.#hostNode = node;
    this.render("host-node");
    if (node.focused) {
      this.focus();
    }
  }

  syncHostChrome(chrome: ShellRoomHostChrome | undefined): void {
    this.#hostChrome = chrome;
    this.render("host-chrome");
  }

  focus(): void {
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
    if (this.#hostNode === null) {
      this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    }
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
    if (this.#hostNode === null) {
      this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    }
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    this.#hostChromeController.destroy();
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
    const host = this.#hostNode;
    const rootLeft = host?.rect.x ?? 0;
    const rootTop = host?.rect.y ?? 0;
    const rootWidth = host ? Math.max(1, host.rect.width) : width;
    const rootHeight = host ? Math.max(3, host.rect.height) : height;
    const borderCells = host ? 1 : 0;
    const contentWidth = Math.max(1, rootWidth - borderCells * 2);
    const contentHeight = Math.max(3, rootHeight - borderCells * 2);
    const usesHostChrome = host !== null && this.#hostChrome !== undefined;
    const composerHeight = this.#composerMode === "textarea" ? 3 : 3;
    const bodyHeight = Math.max(1, contentHeight - composerHeight - (usesHostChrome ? 1 : 2));
    this.#actionRegions = [];
    this.#chromeRegions = [];
    this.#root.left = rootLeft;
    this.#root.top = rootTop;
    this.#root.width = rootWidth;
    this.#root.height = rootHeight;
    this.#root.border = host !== null;
    this.#root.borderColor = host?.focused ? "#22c55e" : "#475569";
    this.#syncHostChrome();
    this.#titleLine.top = 0;
    this.#titleLine.left = 0;
    this.#titleLine.width = contentWidth;
    this.#titleLine.visible = !usesHostChrome;
    this.#scrollBox.top = usesHostChrome ? 0 : 1;
    this.#scrollBox.left = 0;
    this.#scrollBox.width = contentWidth;
    this.#scrollBox.height = bodyHeight;
    this.#statusLine.left = 0;
    this.#statusLine.top = Math.max(0, contentHeight - composerHeight - 1);
    this.#statusLine.width = contentWidth;
    this.#draftPrompt.left = 0;
    this.#draftPrompt.top = Math.max(0, contentHeight - composerHeight);
    this.#draftInput.left = 2;
    this.#draftInput.top = Math.max(0, contentHeight - composerHeight);
    this.#draftInput.width = Math.max(1, contentWidth - 2);
    this.#draftInput.height = composerHeight;
    this.#historyPanel.left = 2;
    this.#historyPanel.top = Math.max(0, contentHeight - composerHeight);
    this.#historyPanel.width = Math.max(1, contentWidth - 2);
    this.#historyPanel.height = composerHeight;
    this.#confirmTitle.left = 2;
    this.#confirmTitle.top = Math.max(0, contentHeight - composerHeight);
    this.#confirmTitle.width = Math.max(1, contentWidth - 2);
    this.#confirmMessage.left = 2;
    this.#confirmMessage.top = Math.max(0, contentHeight - composerHeight + 1);
    this.#confirmMessage.width = Math.max(1, contentWidth - 2);
    this.#confirmActions.left = 2;
    this.#confirmActions.top = Math.max(0, contentHeight - 1);
    this.#confirmActions.width = Math.max(1, contentWidth - 2);

    const rows = buildShellRoomRows({
      messages: resolveRoomMessages(this.#state, this.#input.attached.room.entry.chatId),
      avatarActorId: this.#input.attached.avatarActorId,
      width: Math.max(1, contentWidth - 3),
    });
    this.#renderTitle(contentWidth);
    this.#renderRows(rows, contentWidth);
    this.#syncScrollTop(this.#scrollTop);
    this.#statusLine.content = this.#formatStatusLine(contentWidth);
    this.#draftPrompt.content = "> ";
    this.#syncComposerSurface(contentWidth);
    this.#renderer.requestRender();
  }

  #renderTitle(width: number): void {
    if (this.#hostNode !== null && this.#hostChrome !== undefined) {
      this.#titleLine.content = "";
      return;
    }
    const controls = [
      { action: "layout-left" as const, label: shellPaneButtonLabel("←") },
      { action: "layout-right" as const, label: shellPaneButtonLabel("→") },
      { action: "layout-float" as const, label: shellPaneButtonLabel("⿻") },
      { action: "close" as const, label: shellPaneButtonLabel("x") },
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
    this.#titleLine.content = padShellRoomText(content, width);
  }

  #syncHostChrome(): void {
    const chrome = this.#hostChrome;
    const host = this.#hostNode;
    if (!chrome || !host) {
      this.#root.title = "";
      this.#hostChromeController.hide();
      return;
    }
    this.#chromeRegions = this.#hostChromeController.sync({
      root: this.#root,
      rect: host.rect,
      state: {
        title: chrome.title,
        hoveredActionId: this.#hoveredChromeAction,
        actions: (chrome.actions ?? defaultRoomChromeActions).map((action) =>
          roomChromeActionToTitleAction(action, chrome.layoutMode),
        ),
      },
    });
  }

  #renderRows(rows: readonly ShellRoomRenderRow[], width: number): void {
    const signature = rowSignature(rows);
    if (signature === this.#rowsSignature) {
      return;
    }
    this.#rowsSignature = signature;

    const liveKeys = new Set<string>();
    rows.forEach((row, index) => {
      liveKeys.add(row.key);
      const content = typeof row.content === "string" ? padShellRoomText(row.content, width) : row.content;
      let renderable = this.#renderedRows.get(row.key);
      if (!renderable) {
        renderable = new TextRenderable(this.#renderer, {
          id: `shell-room-row-${row.key}`,
          width: "100%",
          height: 1,
          content,
          bg: "#101820",
          fg: "#e5e7eb",
          selectable: true,
          selectionBg: "#86efac",
          selectionFg: "#052e16",
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
    return padShellRoomText(text, width);
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
        name: padShellRoomText(item.text, width - 2),
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
      this.#confirmTitle.content = padShellRoomText(this.#confirmState.title, width - 2);
      this.#confirmMessage.content = padShellRoomText(this.#confirmState.message, width - 2);
      this.#confirmActions.content = padShellRoomText(
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
    if (this.#selectionBehavior.handleMouseDown(event)) {
      if (event.type === "down" && event.button === 0 && this.#hostNode) {
        this.#input.onHostFocus?.(this.#hostNode.id);
      }
      return;
    }
    if (this.#buttonPress.handleMouseDown(event)) {
      return;
    }
    if (!this.#resolveActionRegionAt(event)) {
      if (event.type === "down" && event.button === 0) {
        if (this.#hostNode) {
          this.#input.onHostFocus?.(this.#hostNode.id);
        }
        if (!this.#isTranscriptSelectionTarget(event.target)) {
          this.#focusDraftLater();
        }
      }
    }
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

  #resolveActionRegionAt(event: MouseEvent): RoomActionRegion | null {
    return (
      this.#actionRegions.find(
        (candidate) =>
          Math.trunc(event.y) === candidate.row &&
          Math.trunc(event.x) >= candidate.col &&
          Math.trunc(event.x) < candidate.col + candidate.width,
      ) ?? null
    );
  }

  #isTranscriptSelectionTarget(renderable: Renderable | null): boolean {
    if (!renderable) {
      return false;
    }
    const targetIds = new Set<string>([
      ...this.#renderedRows.values(),
      this.#statusLine,
      this.#confirmTitle,
      this.#confirmMessage,
    ].map((target) => target.id));
    let cursor: Renderable | null = renderable;
    while (cursor) {
      if (targetIds.has(cursor.id)) {
        return true;
      }
      cursor = cursor.parent;
    }
    return false;
  }

  #resolveMouseAction(event: MouseEvent): ShellRoomHostChromeAction | null {
    const chromeAction = resolveShellPaneChromeClick({ event, regions: this.#chromeRegions });
    if (
      chromeAction === "close" ||
      chromeAction === "layout-left" ||
      chromeAction === "layout-right" ||
      chromeAction === "layout-float"
    ) {
      return chromeAction as ShellRoomHostChromeAction;
    }
    return this.#resolveActionRegionAt(event)?.action ?? null;
  }

  #commitMouseAction(action: ShellRoomHostChromeAction): void {
    if (action === "close") {
      this.#input.onQuit?.();
      return;
    }
    const chromeMode = roomChromeActionToLayoutMode(action);
    if (chromeMode) {
      this.#requestHostLayout(chromeMode);
    }
  }

  handleKeypress(value: unknown): boolean {
    const key = readKeyEvent(value);
    if (!key || key.defaultPrevented) {
      return false;
    }
    return this.#consumeKey(key);
  }

  #handleKeypress = (value: unknown): void => {
    this.handleKeypress(value);
  };

  #consumeKey(key: KeyEvent): boolean {
    if (this.#composerMode === "panel" && matchesShellPanelBinding(this.#keybindings, "cancel", key)) {
      key.preventDefault();
      this.#composerMode = "textarea";
      this.#focusDraftLater();
      this.render("history-cancel");
      return true;
    }
    if (this.#composerMode === "confirm" && matchesShellPanelBinding(this.#keybindings, "cancel", key)) {
      key.preventDefault();
      this.#confirmKeepAndInsert();
      return true;
    }
    if (this.#composerMode === "confirm" && matchesShellPanelBinding(this.#keybindings, "confirm", key)) {
      key.preventDefault();
      this.#confirmReplaceDraft();
      return true;
    }
    if ((key.ctrl && key.name === "q") || key.name === "escape") {
      if (this.#composerMode === "panel") {
        key.preventDefault();
        this.#composerMode = "textarea";
        this.#focusDraftLater();
        this.render("history-cancel");
        return true;
      }
      if (this.#composerMode === "confirm") {
        key.preventDefault();
        this.#confirmKeepAndInsert();
        return true;
      }
      if (key.name === "escape" && this.#draftInput.plainText.length > 0) {
        key.preventDefault();
        this.#draftInput.setText("");
        this.#textareaState.value = "";
        this.#textareaState.selection = null;
        this.#statusNotice = null;
        this.#focusDraftLater();
        this.render("draft-clear");
        return true;
      }
      key.preventDefault();
      this.#input.onQuit?.();
      return true;
    }
    if (key.ctrl && key.name === "left") {
      key.preventDefault();
      this.#requestHostLayout("left");
      return true;
    }
    if (key.ctrl && key.name === "right") {
      key.preventDefault();
      this.#requestHostLayout("right");
      return true;
    }
    if (key.ctrl && key.name === "up") {
      key.preventDefault();
      this.#requestHostLayout("float");
      return true;
    }
    if (key.name === "up" || key.name === "down") {
      if (this.#composerMode === "textarea") {
        return false;
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
      return true;
    }
    if (this.#composerMode === "textarea" && matchesShellTextareaBinding(this.#keybindings, "copy", key)) {
      key.preventDefault();
      this.#copyDraftSelection();
      return true;
    }
    if (this.#composerMode === "textarea" && matchesShellTextareaBinding(this.#keybindings, "paste", key)) {
      key.preventDefault();
      void this.#pasteClipboardText();
      return true;
    }
    if (this.#composerMode === "textarea" && matchesShellComposerBinding(this.#keybindings, "history", key)) {
      key.preventDefault();
      void this.#openHistoryPanel();
      return true;
    }
    if (this.#composerMode === "confirm" && key.name === "return") {
      key.preventDefault();
      this.#confirmReplaceDraft();
      return true;
    }
    return false;
  }

  #requestHostLayout(mode: ShellRoomLayoutMode): void {
    if (!this.#input.onLayoutRequest) {
      this.#statusNotice = "layout controls are available inside the shell host";
      this.render(`layout-${mode}-unavailable`);
      return;
    }
    this.#statusNotice = `switching Chat layout to ${layoutModeTitle(mode)}...`;
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
    if (resolveShellComposerSlashCommands(this.#keybindings, "history").includes(normalizedText)) {
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
      await this.#input.store
        .hydrateGlobalRoomSnapshot({
          chatId: this.#input.attached.room.entry.chatId,
          accessToken: this.#input.attached.room.entry.accessToken,
          force: true,
        })
        .catch((error: unknown) => {
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
    const selected = this.#historyPanel.getSelectedOption()?.value as ShellHistoryItem | undefined;
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

export const startShellRoomApp = async (
  input: ShellRoomAppInput,
): Promise<{ app: ShellRoomApp; renderer: CliRenderer }> => {
  const renderer =
    input.renderer ??
    (await createCliRenderer({
      exitOnCtrlC: false,
      useMouse: true,
      enableMouseMovement: true,
      useKittyKeyboard: { events: true },
    }));
  const app = new ShellRoomApp({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return { app, renderer };
};

import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  InputRenderable,
  parseColor,
  StyledText,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
  type TextChunk,
} from "@opentui/core";

import { padShellRoomText } from "../app-room/room-model";
import {
  buildShellNavigationTerminalRow,
  normalizeNewAvatarNickname,
  type ShellNavigationAvatarItem,
  type ShellNavigationShellItem,
} from "./navigation-model";
import { createBorderedContentRegionMapper } from "./screen-region";
import { SelectableWrappedList, type SelectableWrappedListItem } from "./selectable-wrapped-list";

export interface ShellNavigationAppInput {
  shellItems: readonly ShellNavigationShellItem[];
  defaultShellIndex: number;
  needsShell: boolean;
  avatarItems: readonly ShellNavigationAvatarItem[];
  defaultAvatarIndex: number;
  needsAvatar: boolean;
  initialShellName?: string;
  initialAvatarNickname?: string;
  renderer?: CliRenderer;
  createAvatar(nickname: string): Promise<void>;
  onComplete(selection: ShellNavigationSelection): void;
  onCancel?(): void;
}

export interface ShellNavigationSelection {
  shellName: string;
  avatarNickname: string;
  createAvatar: boolean;
  entryKind?: "existing-shell" | "new-shell";
  skipBindingGrantEnsure?: boolean;
}

type NavigationStep = "shell" | "avatar";

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

const clampIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, index));
};

const avatarLabel = (item: ShellNavigationAvatarItem): string => {
  if (item.kind === "new-avatar") {
    return "+ New Avatar";
  }
  const classify = item.classify ? `  ${item.classify}` : "";
  return `@${item.nickname}  ${item.displayName}${classify}`;
};

const chunk = (text: string, fg: string): TextChunk => ({
  __isChunk: true,
  text,
  fg: parseColor(fg),
});

const withRowPrefix = (
  line: { plainText: string; content: string | StyledText },
  prefix: string,
  width: number,
): string | StyledText => {
  if (typeof line.content === "string") {
    return padShellRoomText(`${prefix}${line.plainText}`, width);
  }
  return new StyledText([chunk(prefix, "#cbd5e1"), ...line.content.chunks]);
};

export class ShellNavigationApp {
  readonly #input: ShellNavigationAppInput;
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #root: BoxRenderable;
  readonly #title: TextRenderable;
  readonly #subtitle: TextRenderable;
  readonly #footer: TextRenderable;
  readonly #list: SelectableWrappedList<ShellNavigationShellItem | ShellNavigationAvatarItem>;
  readonly #dialogBox: BoxRenderable;
  readonly #dialogTitle: TextRenderable;
  readonly #dialogStatus: TextRenderable;
  readonly #dialogInput: InputRenderable;
  #shellItems: readonly ShellNavigationShellItem[];
  #avatarItems: readonly ShellNavigationAvatarItem[];
  readonly #startupRenderTimers: Timer[] = [];
  #disposed = false;
  #step: NavigationStep;
  #shellIndex: number;
  #avatarIndex: number;
  #selectedShellName: string | null;
  #selectedAvatarNickname: string | null;
  #selectedEntryKind: ShellNavigationSelection["entryKind"] = undefined;
  #skipBindingGrantEnsure = false;
  #avatarWasCreated = false;
  #dialogOpen = false;
  #notice: string | null = null;

  constructor(input: ShellNavigationAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#shellItems = input.shellItems;
    this.#avatarItems = input.avatarItems;
    this.#step = input.needsShell ? "shell" : "avatar";
    this.#shellIndex = clampIndex(input.defaultShellIndex, input.shellItems.length);
    this.#avatarIndex = clampIndex(input.defaultAvatarIndex, input.avatarItems.length);
    this.#selectedShellName = input.initialShellName ?? null;
    this.#selectedAvatarNickname = input.initialAvatarNickname ?? null;
    this.#root = new BoxRenderable(this.#renderer, {
      id: "shell-navigation-root",
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "#0f172a",
      border: true,
      borderColor: "#38bdf8",
    });
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#root.onMouseUp = (event) => this.#handleMouseUp(event);
    this.#title = new TextRenderable(this.#renderer, {
      id: "shell-navigation-title",
      position: "absolute",
      top: 1,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#f8fafc",
      bg: "#0f172a",
    });
    this.#subtitle = new TextRenderable(this.#renderer, {
      id: "shell-navigation-subtitle",
      position: "absolute",
      top: 2,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#94a3b8",
      bg: "#0f172a",
    });
    this.#footer = new TextRenderable(this.#renderer, {
      id: "shell-navigation-footer",
      position: "absolute",
      top: 1,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#94a3b8",
      bg: "#0f172a",
    });
    this.#list = new SelectableWrappedList<ShellNavigationShellItem | ShellNavigationAvatarItem>({
      renderer: this.#renderer,
      parent: this.#root,
      idPrefix: "shell-navigation-row",
      regionMapper: createBorderedContentRegionMapper(this.#root),
      formatLine: ({ line, prefix, width }) => withRowPrefix(line, prefix, width),
      onSelectionChange: (index) => {
        if (this.#step === "shell") {
          this.#shellIndex = index;
          return;
        }
        this.#avatarIndex = index;
      },
      onConfirm: () => {
        void this.#confirmCurrent();
      },
    });
    this.#dialogBox = new BoxRenderable(this.#renderer, {
      id: "shell-navigation-dialog",
      position: "absolute",
      top: 4,
      left: 4,
      width: 1,
      height: 7,
      backgroundColor: "#111827",
      border: true,
      borderColor: "#a78bfa",
      zIndex: 10,
    });
    this.#dialogTitle = new TextRenderable(this.#renderer, {
      id: "shell-navigation-dialog-title",
      position: "absolute",
      top: 1,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#f8fafc",
      bg: "#111827",
    });
    this.#dialogInput = new InputRenderable(this.#renderer, {
      id: "shell-navigation-dialog-input",
      position: "absolute",
      top: 3,
      left: 2,
      width: 1,
      placeholder: "avatar nickname",
      backgroundColor: "#020617",
      textColor: "#f8fafc",
      cursorColor: "#38bdf8",
      focusedBackgroundColor: "#020617",
      placeholderColor: "#64748b",
    });
    this.#dialogStatus = new TextRenderable(this.#renderer, {
      id: "shell-navigation-dialog-status",
      position: "absolute",
      top: 5,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#facc15",
      bg: "#111827",
    });
    this.#dialogBox.add(this.#dialogTitle);
    this.#dialogBox.add(this.#dialogInput);
    this.#dialogBox.add(this.#dialogStatus);
    this.#dialogBox.visible = false;
    this.#root.add(this.#title);
    this.#root.add(this.#subtitle);
    this.#root.add(this.#footer);
    this.#root.add(this.#dialogBox);
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
    const height = Math.max(8, this.#renderer.height);
    const contentWidth = Math.max(1, width - 5);
    this.#root.width = width;
    this.#root.height = height;
    this.#title.width = contentWidth;
    this.#subtitle.width = contentWidth;
    this.#footer.top = Math.max(0, height - 2);
    this.#footer.width = contentWidth;
    this.#dialogBox.width = Math.min(Math.max(32, Math.trunc(width * 0.7)), Math.max(1, width - 8));
    this.#dialogBox.left = Math.max(1, Math.floor((width - Number(this.#dialogBox.width)) / 2));
    this.#dialogBox.top = Math.max(2, Math.floor((height - 7) / 2));
    this.#dialogTitle.width = Math.max(1, Number(this.#dialogBox.width) - 4);
    this.#dialogInput.width = Math.max(1, Number(this.#dialogBox.width) - 4);
    this.#dialogStatus.width = Math.max(1, Number(this.#dialogBox.width) - 4);
    this.#renderRows(width, height);
    this.#renderDialog();
    this.#renderer.requestRender();
  }

  updateShellItems(input: { shellItems: readonly ShellNavigationShellItem[]; defaultShellIndex?: number }): void {
    const selectedShellName = this.#shellItems[this.#shellIndex]?.shellName ?? null;
    this.#shellItems = input.shellItems;
    const selectedIndex =
      selectedShellName === null ? -1 : this.#shellItems.findIndex((item) => item.shellName === selectedShellName);
    this.#shellIndex =
      selectedIndex >= 0
        ? selectedIndex
        : clampIndex(input.defaultShellIndex ?? this.#shellIndex, this.#shellItems.length);
    this.render("shell-items-updated");
  }

  #renderRows(width: number, height: number): void {
    const items = this.#step === "shell" ? this.#shellItems : this.#avatarItems;
    const selectedIndex = this.#step === "shell" ? this.#shellIndex : this.#avatarIndex;
    const title = this.#step === "shell" ? "Select Terminal" : "Select Avatar";
    const subtitle =
      this.#step === "shell"
        ? "Choose a live Terminal/Room binding or create the next shell-N."
        : "Choose an Avatar or create one by nickname.";
    const contentWidth = Math.max(1, width - 5);
    this.#title.content = padShellRoomText(title, contentWidth);
    this.#subtitle.content = padShellRoomText(this.#notice ?? subtitle, contentWidth);
    this.#footer.content = padShellRoomText("↑/↓ select | Enter confirm | Esc cancel | Mouse click", contentWidth);
    const availableRows = Math.max(1, height - 6);
    const rowWidth = Math.max(1, contentWidth - 2);
    this.#list.render({
      items,
      selectedIndex,
      top: 4,
      left: 2,
      width: contentWidth,
      itemWidth: rowWidth,
      availableRows,
      renderItem: (item, itemWidth) => this.#renderItemLines(item, itemWidth),
    });
  }

  #renderItemLines(item: ShellNavigationShellItem | ShellNavigationAvatarItem, width: number): SelectableWrappedListItem {
    if (this.#step === "shell") {
      return buildShellNavigationTerminalRow(item as ShellNavigationShellItem, width);
    }
    const plainText = avatarLabel(item as ShellNavigationAvatarItem);
    return { lines: [{ plainText, content: plainText }] };
  }

  #renderDialog(): void {
    this.#dialogBox.visible = this.#dialogOpen;
    if (!this.#dialogOpen) {
      return;
    }
    const width = Math.max(1, Number(this.#dialogBox.width) - 4);
    this.#dialogTitle.content = padShellRoomText("Create Avatar", width);
    this.#dialogStatus.content = padShellRoomText("Enter create + select | Esc back", width);
    this.#dialogInput.focus();
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

  #handleMouseDown(event: MouseEvent): void {
    if (this.#dialogOpen) {
      this.#list.resetPointer();
      return;
    }
    if (this.#list.handleMouseDown(event)) {
      this.render("mouse-select");
    }
  }

  #handleMouseUp(event: MouseEvent): void {
    if (this.#dialogOpen) {
      this.#list.resetPointer();
      return;
    }
    this.#list.handleMouseUp(event);
  }

  #handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    if (this.#dialogOpen) {
      this.#handleDialogKeypress(key);
      return;
    }
    if (key.name === "escape" || (key.ctrl && key.name === "q")) {
      key.preventDefault();
      this.#input.onCancel?.();
      return;
    }
    if (key.name === "up") {
      key.preventDefault();
      this.#moveSelection(-1);
      return;
    }
    if (key.name === "down") {
      key.preventDefault();
      this.#moveSelection(1);
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      key.preventDefault();
      void this.#confirmCurrent();
    }
  };

  #handleDialogKeypress(key: KeyEvent): void {
    if (key.name === "escape") {
      key.preventDefault();
      this.#dialogOpen = false;
      this.#notice = null;
      this.render("dialog-cancel");
      return;
    }
    if (key.name === "return" || key.name === "enter") {
      key.preventDefault();
      void this.#confirmAvatarCreate();
    }
  }

  #moveSelection(delta: number): void {
    if (this.#list.moveSelection(delta)) {
      this.render("selection");
    }
  }

  async #confirmCurrent(): Promise<void> {
    this.#notice = null;
    if (this.#step === "shell") {
      const item = this.#shellItems[this.#shellIndex];
      if (!item) {
        return;
      }
      this.#selectedShellName = item.shellName;
      this.#selectedEntryKind = item.kind === "shell" ? "existing-shell" : "new-shell";
      this.#skipBindingGrantEnsure = item.kind === "shell";
      if (item.kind === "shell") {
        this.#selectedAvatarNickname = this.#input.initialAvatarNickname ?? item.avatarNickname;
        this.#completeIfReady();
        return;
      }
      if (this.#input.needsAvatar) {
        this.#step = "avatar";
        this.render("shell-selected");
        return;
      }
      this.#completeIfReady();
      return;
    }
    const item = this.#avatarItems[this.#avatarIndex];
    if (!item) {
      return;
    }
    if (item.kind === "new-avatar") {
      this.#dialogOpen = true;
      this.#dialogInput.value = "";
      this.render("avatar-dialog");
      return;
    }
    this.#selectedAvatarNickname = item.nickname;
    this.#completeIfReady();
  }

  async #confirmAvatarCreate(): Promise<void> {
    try {
      const nickname = normalizeNewAvatarNickname(String(this.#dialogInput.value ?? ""));
      this.#notice = `creating @${nickname}...`;
      this.render("avatar-create-start");
      await this.#input.createAvatar(nickname);
      this.#selectedAvatarNickname = nickname;
      this.#avatarWasCreated = true;
      this.#dialogOpen = false;
      this.#completeIfReady();
    } catch (error) {
      this.#notice = error instanceof Error ? error.message : String(error);
      this.render("avatar-create-error");
    }
  }

  #completeIfReady(): void {
    const shellName = this.#selectedShellName;
    const avatarNickname = this.#selectedAvatarNickname;
    if (!shellName || !avatarNickname) {
      return;
    }
    this.#input.onComplete({
      shellName,
      avatarNickname,
      createAvatar: this.#avatarWasCreated,
      entryKind: this.#selectedEntryKind,
      skipBindingGrantEnsure: this.#skipBindingGrantEnsure,
    });
  }
}

export const startShellNavigationApp = async (
  input: ShellNavigationAppInput,
): Promise<{ app: ShellNavigationApp; renderer: CliRenderer }> => {
  const renderer =
    input.renderer ?? (await createCliRenderer({ exitOnCtrlC: false, useMouse: true, enableMouseMovement: true }));
  const app = new ShellNavigationApp({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return { app, renderer };
};

import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  InputRenderable,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
} from "@opentui/core";

import { padShellRoomText } from "../app-room/room-model";
import {
  buildShellNavigationTerminalRow,
  normalizeNewAvatarNickname,
  type ShellNavigationAvatarItem,
  type ShellNavigationShellItem,
} from "./navigation-model";

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

interface NavigationRegion {
  index: number;
  row: number;
  col: number;
  width: number;
}

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

export class ShellNavigationApp {
  readonly #input: ShellNavigationAppInput;
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #root: BoxRenderable;
  readonly #title: TextRenderable;
  readonly #subtitle: TextRenderable;
  readonly #footer: TextRenderable;
  readonly #dialogBox: BoxRenderable;
  readonly #dialogTitle: TextRenderable;
  readonly #dialogStatus: TextRenderable;
  readonly #dialogInput: InputRenderable;
  readonly #rows: TextRenderable[] = [];
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
  #regions: NavigationRegion[] = [];

  constructor(input: ShellNavigationAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
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
    this.#regions = [];
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

  #renderRows(width: number, height: number): void {
    const items = this.#step === "shell" ? this.#input.shellItems : this.#input.avatarItems;
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
    const firstIndex = Math.max(
      0,
      Math.min(selectedIndex - Math.floor(availableRows / 2), Math.max(0, items.length - availableRows)),
    );
    while (this.#rows.length < availableRows) {
      const row = new TextRenderable(this.#renderer, {
        id: `shell-navigation-row-${this.#rows.length}`,
        position: "absolute",
        top: 4 + this.#rows.length,
        left: 2,
        width: 1,
        height: 1,
        content: "",
        fg: "#e5e7eb",
        bg: "#0f172a",
      });
      this.#rows.push(row);
      this.#root.add(row);
    }
    for (const [rowIndex, row] of this.#rows.entries()) {
      const itemIndex = firstIndex + rowIndex;
      const item = items[itemIndex];
      row.top = 4 + rowIndex;
      row.left = 2;
      row.width = contentWidth;
      row.visible = rowIndex < availableRows;
      if (!item) {
        row.content = padShellRoomText("", contentWidth);
        row.bg = "#0f172a";
        continue;
      }
      const selected = itemIndex === selectedIndex;
      const label =
        this.#step === "shell"
          ? buildShellNavigationTerminalRow(item as ShellNavigationShellItem, Math.max(1, contentWidth - 2))
          : {
              plainText: avatarLabel(item as ShellNavigationAvatarItem),
              content: avatarLabel(item as ShellNavigationAvatarItem),
            };
      if (typeof label.content === "string") {
        row.content = padShellRoomText(`${selected ? ">" : " "} ${label.content}`, contentWidth);
      } else {
        row.content = label.content;
      }
      row.fg = selected ? "#f8fafc" : "#cbd5e1";
      row.bg = selected ? "#1e3a8a" : "#0f172a";
      this.#regions.push({
        index: itemIndex,
        row: Number(row.top),
        col: Number(row.left),
        width: contentWidth,
      });
    }
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
      return;
    }
    const region = this.#regions.find(
      (candidate) =>
        Math.trunc(event.y) === candidate.row &&
        Math.trunc(event.x) >= candidate.col &&
        Math.trunc(event.x) < candidate.col + candidate.width,
    );
    if (!region) {
      return;
    }
    event.preventDefault();
    if (this.#step === "shell") {
      this.#shellIndex = region.index;
    } else {
      this.#avatarIndex = region.index;
    }
    void this.#confirmCurrent();
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
    if (this.#step === "shell") {
      this.#shellIndex = clampIndex(this.#shellIndex + delta, this.#input.shellItems.length);
    } else {
      this.#avatarIndex = clampIndex(this.#avatarIndex + delta, this.#input.avatarItems.length);
    }
    this.render("selection");
  }

  async #confirmCurrent(): Promise<void> {
    this.#notice = null;
    if (this.#step === "shell") {
      const item = this.#input.shellItems[this.#shellIndex];
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
    const item = this.#input.avatarItems[this.#avatarIndex];
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

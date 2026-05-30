import { BoxRenderable, RGBA, TextRenderable, type CliRenderer, type KeyEvent, type MouseEvent } from "@opentui/core";

import { markShellKeyHandled } from "../app/key-event-scope";
import {
  buildShellButtonStyledText,
  normalizeShellButtonLabel,
  resolveShellButtonAt,
  type ShellButtonRegion,
} from "../renderable-mux/button";
import { ShellButtonPressController } from "../renderable-mux/button-press-controller";
import {
  ShellPaneChromeController,
  resolveShellPaneChromeClick,
  shellPaneCloseAction,
  type ShellPaneChromeHitRegion,
} from "../renderable-mux/pane-chrome";
import type { LayoutRect } from "../renderable-mux/layout";

export const SHELL_APPROVAL_LEASE_MS = 5 * 60_000;

export interface ShellApprovalRequest {
  readonly requestId: string;
  readonly terminalId: string;
  readonly participantId: string;
  readonly status: "pending" | "approved" | "denied" | "expired";
  readonly requestedInput?: {
    readonly mode?: string;
    readonly text?: string;
  };
  readonly createdAt: number;
}

export interface ShellApprovalStore {
  getPendingApproval(): ShellApprovalRequest | null;
  approve(input: { terminalId: string; requestId: string; durationMs: number }): Promise<void> | void;
  deny(input: { terminalId: string; requestId: string }): Promise<void> | void;
  refresh?(): Promise<void> | void;
  subscribe?(listener: () => void): () => void;
}

export interface ShellCloseConfirmState {
  readonly title: string;
  readonly onBackgroundRun: () => void | Promise<void>;
  readonly onTerminate: () => void | Promise<void>;
}

export interface ShellTopLayerSurfaceInput {
  renderer: CliRenderer;
  store: ShellApprovalStore;
  shellName: string;
  onClose?: () => void;
}

type OverlayMode = "approval" | "close-confirm" | "empty";
type ActionName = "approve" | "deny" | "close" | "background-run" | "terminate";

interface ActionRegion {
  readonly id: ActionName;
  readonly action: ActionName;
  readonly row: number;
  readonly col: number;
  readonly width: number;
}

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

const clipLine = (text: string, width: number): string => text.slice(0, Math.max(1, width));

const absoluteChildRow = (top: number, child: TextRenderable): number => top + 1 + Number(child.top);
const absoluteChildCol = (left: number, child: TextRenderable): number => left + 1 + Number(child.left);
const topLayerActionFg = RGBA.fromHex("#f8fafc");
const actionGap = "  ";

export class ShellTopLayerSurface {
  readonly #renderer: CliRenderer;
  readonly #store: ShellApprovalStore;
  readonly #shellName: string;
  readonly #onClose: (() => void) | undefined;
  readonly #root: BoxRenderable;
  readonly #title: TextRenderable;
  readonly #actor: TextRenderable;
  readonly #preview: TextRenderable;
  readonly #actions: TextRenderable;
  readonly #status: TextRenderable;
  readonly #chrome: ShellPaneChromeController;
  #releaseStore: (() => void) | null = null;
  #actionRegions: ActionRegion[] = [];
  #chromeRegions: readonly ShellPaneChromeHitRegion[] = [];
  #hoveredAction: ActionName | null = null;
  #hoveredChromeAction: string | null = null;
  #statusNotice: string | null = null;
  #visible = false;
  #closeConfirm: ShellCloseConfirmState | null = null;
  readonly #buttonPress: ShellButtonPressController<ActionName>;

  constructor(input: ShellTopLayerSurfaceInput) {
    this.#renderer = input.renderer;
    this.#store = input.store;
    this.#shellName = input.shellName;
    this.#onClose = input.onClose;
    this.#buttonPress = new ShellButtonPressController({
      resolveAction: (event) => this.#resolveMouseAction(event),
      onClick: (action, event) => {
        event.preventDefault();
        void this.#handleRegion(action);
      },
      onHoverChange: (action) => {
        const hoveredChromeAction = action === "close" ? "close" : null;
        const hoveredAction = action === "close" ? null : action;
        if (hoveredChromeAction === this.#hoveredChromeAction && hoveredAction === this.#hoveredAction) {
          return;
        }
        this.#hoveredChromeAction = hoveredChromeAction;
        this.#hoveredAction = hoveredAction;
        this.render();
      },
    });
    this.#root = new BoxRenderable(this.#renderer, {
      id: "shell-top-layer",
      position: "absolute",
      top: 1,
      left: 2,
      width: 1,
      height: 1,
      backgroundColor: "#111827",
      border: true,
      borderStyle: "rounded",
      borderColor: "#93c5fd",
      zIndex: 100,
      visible: false,
      focusable: true,
    });
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#root.onMouseUp = (event) => this.#handleMouseUp(event);
    this.#root.onMouseMove = (event) => this.#handleMouseMove(event);
    this.#title = this.#createText("shell-top-title", 1, "#f8fafc");
    this.#actor = this.#createText("shell-top-actor", 3, "#cbd5e1");
    this.#preview = this.#createText("shell-top-preview", 5, "#f8fafc");
    this.#actions = this.#createText("shell-top-actions", 7, "#f8fafc");
    this.#status = this.#createText("shell-top-status", 9, "#facc15");
    this.#chrome = new ShellPaneChromeController({
      renderer: this.#renderer,
      id: "shell-top-layer-chrome",
      bg: "#111827",
      zIndex: 101,
      onMouseDown: (event) => this.#handleMouseDown(event),
      onMouseUp: (event) => this.#handleMouseUp(event),
      onMouseMove: (event) => this.#handleMouseMove(event),
    });
    this.#root.add(this.#title);
    this.#root.add(this.#actor);
    this.#root.add(this.#preview);
    this.#root.add(this.#actions);
    this.#root.add(this.#status);
  }

  get root(): BoxRenderable {
    return this.#root;
  }

  get visible(): boolean {
    return this.#visible;
  }

  start(): void {
    this.#releaseStore = this.#store.subscribe?.(() => this.render()) ?? null;
    void this.#store.refresh?.();
    this.render();
  }

  show(): void {
    this.#visible = true;
    this.render();
    this.#root.focus();
  }

  hide(): void {
    this.#visible = false;
    this.#closeConfirm = null;
    this.#root.visible = false;
    this.#chrome.hide();
    this.#buttonPress.reset();
    this.#renderer.requestRender();
  }

  toggle(): void {
    if (this.#visible) {
      this.hide();
      return;
    }
    this.show();
  }

  showCloseConfirm(input: ShellCloseConfirmState): void {
    this.#closeConfirm = input;
    this.show();
  }

  handleKeypress(value: unknown): boolean {
    const key = readKeyEvent(value);
    if (!this.#visible || !key) {
      return false;
    }
    this.#consumeKey(key);
    return true;
  }

  render(): void {
    if (!this.#visible) {
      return;
    }
    const width = Math.max(36, Math.min(this.#renderer.width - 4, 80));
    const height = Math.max(10, Math.min(this.#renderer.height - 2, 14));
    const left = Math.max(0, Math.floor((this.#renderer.width - width) / 2));
    const top = Math.max(0, Math.floor((this.#renderer.height - height) / 2));
    const contentWidth = Math.max(1, width - 4);
    this.#actionRegions = [];
    this.#root.visible = true;
    this.#root.left = left;
    this.#root.top = top;
    this.#root.width = width;
    this.#root.height = height;
    this.#chromeRegions = [];
    for (const child of [this.#title, this.#actor, this.#preview, this.#actions, this.#status]) {
      child.left = 2;
      child.width = contentWidth;
    }
    this.#status.top = Math.max(9, height - 2);

    const mode = this.#resolveMode();
    if (mode === "close-confirm") {
      this.#syncBorderChrome({
        title: this.#closeConfirm?.title ?? "Close shell pane",
        closeable: true,
        left,
        top,
        width,
      });
      this.#renderCloseConfirm(left, top, contentWidth);
      this.#renderer.requestRender();
      return;
    }
    if (mode === "approval") {
      this.#syncBorderChrome({ title: "Terminal write approval", closeable: false, left, top, width });
      this.#renderApproval(left, top, contentWidth);
      this.#renderer.requestRender();
      return;
    }
    this.#syncBorderChrome({ title: `shell top | ${this.#shellName}`, closeable: false, left, top, width });
    this.#title.content = "";
    this.#actor.content = "No pending terminal approvals";
    this.#preview.content = "";
    this.#actions.content = "[ Close ]";
    this.#syncActionButtons(left, top, [{ action: "close", label: "[ Close ]" }]);
    this.#status.content = this.#statusNotice ?? "Esc close";
    this.#renderer.requestRender();
  }

  destroy(): void {
    this.#releaseStore?.();
    this.#releaseStore = null;
    this.#chrome.destroy();
    this.#root.destroyRecursively();
  }

  #resolveMode(): OverlayMode {
    if (this.#closeConfirm) {
      return "close-confirm";
    }
    if (this.#store.getPendingApproval()) {
      return "approval";
    }
    return "empty";
  }

  #renderApproval(left: number, top: number, contentWidth: number): void {
    const request = this.#store.getPendingApproval();
    if (!request) {
      return;
    }
    const deny = "[ Deny ]";
    const approve = "[ Approve ]";
    this.#title.content = "";
    this.#actor.content = clipLine(
      `${request.participantId} requests ${request.requestedInput?.mode ?? "input"} access`,
      contentWidth,
    );
    this.#preview.content = clipLine(request.requestedInput?.text ?? "(no input preview)", contentWidth);
    this.#syncActionButtons(left, top, [
      { action: "deny", label: deny },
      { action: "approve", label: approve },
    ]);
    this.#status.content = this.#statusNotice ?? "A approve | D deny | Esc close";
  }

  #renderCloseConfirm(left: number, top: number, contentWidth: number): void {
    const confirm = this.#closeConfirm;
    if (!confirm) {
      return;
    }
    this.#title.content = "";
    this.#actor.content = "Close this shell pane?";
    this.#preview.content = "Run in background keeps the PTY alive. Terminate terminal kills the PTY.";
    const backgroundRun = "[ Run in background ]";
    const terminate = "[ Terminate terminal ]";
    this.#syncActionButtons(left, top, [
      { action: "background-run", label: backgroundRun },
      { action: "terminate", label: terminate },
    ]);
    this.#status.content = this.#statusNotice ?? "Esc cancel";
  }

  #syncBorderChrome(input: { title: string; closeable: boolean; left: number; top: number; width: number }): void {
    const actions = input.closeable ? [shellPaneCloseAction()] : [];
    const rect: LayoutRect = {
      x: input.left,
      y: input.top,
      width: input.width,
      height: Math.max(1, Number(this.#root.height)),
    };
    this.#chromeRegions = this.#chrome.sync({
      root: this.#root,
      rect,
      state: {
        title: input.title,
        actions,
        hoveredActionId: this.#hoveredChromeAction,
      },
    });
  }

  #syncActionButtons(
    left: number,
    top: number,
    buttons: readonly { readonly action: ActionName; readonly label: string }[],
  ): void {
    const row = absoluteChildRow(top, this.#actions);
    let col = absoluteChildCol(left, this.#actions);
    const parts: Array<string | { button: { id: ActionName; label: string; hovered: boolean }; fg: RGBA }> = [];
    const regions: ActionRegion[] = [];
    buttons.forEach((button, index) => {
      if (index > 0) {
        parts.push(actionGap);
        col += actionGap.length;
      }
      const label = normalizeShellButtonLabel(button.label);
      parts.push({
        button: {
          id: button.action,
          label,
          hovered: this.#hoveredAction === button.action,
        },
        fg: topLayerActionFg,
      });
      regions.push({
        id: button.action,
        action: button.action,
        row,
        col,
        width: Bun.stringWidth(label),
      });
      col += Bun.stringWidth(label);
    });
    this.#actions.content = buildShellButtonStyledText(parts, topLayerActionFg);
    this.#actionRegions = regions;
  }

  #createText(id: string, top: number, fg: string): TextRenderable {
    return new TextRenderable(this.#renderer, {
      id,
      position: "absolute",
      top,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg,
      bg: "#111827",
      wrapMode: "word",
    });
  }

  #handleMouseDown(event: MouseEvent): void {
    if (!this.#visible) {
      return;
    }
    this.#buttonPress.handleMouseDown(event);
  }

  #handleMouseUp(event: MouseEvent): void {
    if (!this.#visible) {
      return;
    }
    this.#buttonPress.handleMouseUp(event);
  }

  #handleMouseMove(event: MouseEvent): void {
    if (!this.#visible) {
      return;
    }
    this.#buttonPress.handleMouseMove(event);
  }

  #resolveActionRegionAt(event: MouseEvent): ActionRegion | null {
    const buttonRegions: ShellButtonRegion[] = this.#actionRegions.map((region) => ({
      id: region.id,
      x: region.col,
      y: region.row,
      width: region.width,
    }));
    const id = resolveShellButtonAt(event, buttonRegions);
    return this.#actionRegions.find((region) => region.id === id) ?? null;
  }

  #resolveMouseAction(event: MouseEvent): ActionName | null {
    const chromeAction = resolveShellPaneChromeClick({ event, regions: this.#chromeRegions });
    if (chromeAction === "close") {
      return "close";
    }
    return this.#resolveActionRegionAt(event)?.action ?? null;
  }

  #consumeKey(key: KeyEvent): void {
    if (key.name === "escape") {
      const wasCloseConfirm = this.#resolveMode() === "close-confirm";
      markShellKeyHandled(key, "top-layer");
      this.hide();
      if (!wasCloseConfirm) {
        this.#onClose?.();
      }
      return;
    }
    if (this.#resolveMode() === "approval") {
      if (key.name === "a") {
        markShellKeyHandled(key, "top-layer");
        void this.#handleRegion("approve");
        return;
      }
      if (key.name === "d") {
        markShellKeyHandled(key, "top-layer");
        void this.#handleRegion("deny");
        return;
      }
    }
    markShellKeyHandled(key, "top-layer");
  }

  async #handleRegion(action: ActionName): Promise<void> {
    if (action === "close") {
      const shouldNotifyClose = this.#closeConfirm === null;
      this.hide();
      if (shouldNotifyClose) {
        this.#onClose?.();
      }
      return;
    }
    if (action === "background-run") {
      const confirm = this.#closeConfirm;
      this.hide();
      if (confirm) {
        await confirm.onBackgroundRun();
      }
      return;
    }
    if (action === "terminate") {
      const confirm = this.#closeConfirm;
      this.hide();
      if (confirm) {
        await confirm.onTerminate();
      }
      return;
    }
    const request = this.#store.getPendingApproval();
    if (!request) {
      this.#statusNotice = "no pending approval";
      this.render();
      return;
    }
    this.#statusNotice = action === "approve" ? "approving terminal write..." : "denying terminal write...";
    this.render();
    try {
      if (action === "approve") {
        await this.#store.approve({
          terminalId: request.terminalId,
          requestId: request.requestId,
          durationMs: SHELL_APPROVAL_LEASE_MS,
        });
      } else {
        await this.#store.deny({
          terminalId: request.terminalId,
          requestId: request.requestId,
        });
      }
      await this.#store.refresh?.();
      this.#statusNotice = action === "approve" ? "terminal write approved" : "terminal write denied";
      this.render();
    } catch (error) {
      this.#statusNotice = `approval failed: ${error instanceof Error ? error.message : String(error)}`;
      this.render();
    }
  }
}

export const createEmptyShellApprovalStore = (): ShellApprovalStore => ({
  getPendingApproval: () => null,
  approve: () => undefined,
  deny: () => undefined,
});

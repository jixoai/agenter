import type { GlobalTerminalApprovalRequest, RuntimeClientState } from "@agenter/client-sdk";
import {
  BoxRenderable,
  CliRenderEvents,
  createCliRenderer,
  TextRenderable,
  type CliRenderer,
  type KeyEvent,
  type MouseEvent,
} from "@opentui/core";

import { APPROVAL_LEASE_DURATION_MS, resolvePendingTerminalApproval } from "./approval-model";
import { padCliShellRoomText } from "./room-model";

export interface CliShellTopLayerAppInput {
  store: CliShellTopLayerAppStore;
  shellName: string;
  terminalId: string;
  renderer?: CliRenderer;
  onQuit?: () => void;
}

export interface CliShellTopLayerAppStore {
  getState(): Pick<RuntimeClientState, "globalTerminalApprovalsById">;
  subscribe(listener: () => void): () => void;
  retainTerminalPermissionRequests(input?: { terminalId?: string }): () => void;
  hydrateGlobalTerminalApprovals(input: { terminalId: string; force?: boolean }): Promise<GlobalTerminalApprovalRequest[]>;
  approveGlobalTerminalRequest(input: { terminalId: string; requestId: string; durationMs: number }): Promise<unknown>;
  denyGlobalTerminalRequest(input: { terminalId: string; requestId: string }): Promise<unknown>;
}

interface TopLayerActionRegion {
  action: "approve" | "deny" | "close";
  row: number;
  col: number;
  width: number;
  terminalId?: string;
  requestId?: string;
}

const readKeyEvent = (value: unknown): KeyEvent | null =>
  typeof value === "object" && value !== null ? (value as KeyEvent) : null;

export class CliShellTopLayerApp {
  readonly #input: CliShellTopLayerAppInput;
  readonly #renderer: CliRenderer;
  readonly #ownsRenderer: boolean;
  readonly #root: BoxRenderable;
  readonly #title: TextRenderable;
  readonly #actor: TextRenderable;
  readonly #preview: TextRenderable;
  readonly #actions: TextRenderable;
  readonly #status: TextRenderable;
  #state: Pick<RuntimeClientState, "globalTerminalApprovalsById">;
  #releaseStore: (() => void) | null = null;
  #releasePermissionRequests: (() => void) | null = null;
  #actionRegions: TopLayerActionRegion[] = [];
  #disposed = false;
  #statusNotice: string | null = null;

  constructor(input: CliShellTopLayerAppInput & { renderer: CliRenderer; ownsRenderer?: boolean }) {
    this.#input = input;
    this.#renderer = input.renderer;
    this.#ownsRenderer = input.ownsRenderer === true;
    this.#state = input.store.getState();
    this.#root = new BoxRenderable(this.#renderer, {
      id: "cli-shell-top-root",
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      backgroundColor: "#111827",
      border: true,
      borderColor: "#93c5fd",
    });
    this.#root.onMouseDown = (event) => this.#handleMouseDown(event);
    this.#title = new TextRenderable(this.#renderer, {
      id: "cli-shell-top-title",
      position: "absolute",
      top: 1,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#f8fafc",
      bg: "#111827",
    });
    this.#actor = new TextRenderable(this.#renderer, {
      id: "cli-shell-top-actor",
      position: "absolute",
      top: 3,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#cbd5e1",
      bg: "#111827",
    });
    this.#preview = new TextRenderable(this.#renderer, {
      id: "cli-shell-top-preview",
      position: "absolute",
      top: 5,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#f8fafc",
      bg: "#111827",
    });
    this.#actions = new TextRenderable(this.#renderer, {
      id: "cli-shell-top-actions",
      position: "absolute",
      top: 7,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#f8fafc",
      bg: "#111827",
    });
    this.#status = new TextRenderable(this.#renderer, {
      id: "cli-shell-top-status",
      position: "absolute",
      top: 9,
      left: 2,
      width: 1,
      height: 1,
      content: "",
      fg: "#facc15",
      bg: "#111827",
    });
    this.#root.add(this.#title);
    this.#root.add(this.#actor);
    this.#root.add(this.#preview);
    this.#root.add(this.#actions);
    this.#root.add(this.#status);
    this.#renderer.root.add(this.#root);
  }

  start(): void {
    if (this.#disposed) {
      return;
    }
    this.#releaseStore = this.#input.store.subscribe(() => {
      this.#state = this.#input.store.getState();
      this.render("store-update");
    });
    this.#releasePermissionRequests = this.#input.store.retainTerminalPermissionRequests({
      terminalId: this.#input.terminalId,
    });
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    void this.#input.store
      .hydrateGlobalTerminalApprovals({
        terminalId: this.#input.terminalId,
        force: true,
      })
      .then(() => {
        this.#state = this.#input.store.getState();
        this.render("hydrate");
      })
      .catch((error: unknown) => {
        this.#statusNotice = `approval hydrate failed: ${error instanceof Error ? error.message : String(error)}`;
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
    const contentWidth = Math.max(1, width - 4);
    this.#actionRegions = [];
    this.#root.width = width;
    this.#root.height = height;
    this.#title.width = contentWidth;
    this.#actor.width = contentWidth;
    this.#preview.width = contentWidth;
    this.#actions.width = contentWidth;
    this.#status.width = contentWidth;
    this.#status.top = Math.max(9, height - 2);

    const request = resolvePendingTerminalApproval(this.#state, this.#input.terminalId);
    if (!request) {
      this.#title.content = padCliShellRoomText(`cli-shell top | ${this.#input.shellName}`, contentWidth);
      this.#actor.content = padCliShellRoomText("No pending terminal approvals", contentWidth);
      this.#preview.content = padCliShellRoomText("", contentWidth);
      this.#actions.content = padCliShellRoomText("[ Close ]", contentWidth);
      this.#status.content = padCliShellRoomText(this.#statusNotice ?? "Esc/Ctrl+Q close", contentWidth);
      this.#actionRegions.push({
        action: "close",
        row: Number(this.#actions.top),
        col: Number(this.#actions.left),
        width: Bun.stringWidth("[ Close ]"),
      });
      this.#renderer.requestRender();
      return;
    }

    this.#title.content = padCliShellRoomText("Terminal write approval", contentWidth);
    this.#actor.content = padCliShellRoomText(
      `${request.participantId} requests ${request.requestedInput?.mode ?? "input"} access`,
      contentWidth,
    );
    this.#preview.content = padCliShellRoomText(request.requestedInput?.text ?? "(no input preview)", contentWidth);
    const deny = "[ Deny ]";
    const approve = "[ Approve ]";
    const gap = "  ";
    this.#actions.content = padCliShellRoomText(`${deny}${gap}${approve}`, contentWidth);
    this.#status.content = padCliShellRoomText(this.#statusNotice ?? "A approve | D deny | Esc close", contentWidth);
    const actionRow = Number(this.#actions.top);
    const actionCol = Number(this.#actions.left);
    this.#actionRegions.push(
      {
        action: "deny",
        terminalId: request.terminalId,
        requestId: request.requestId,
        row: actionRow,
        col: actionCol,
        width: Bun.stringWidth(deny),
      },
      {
        action: "approve",
        terminalId: request.terminalId,
        requestId: request.requestId,
        row: actionRow,
        col: actionCol + Bun.stringWidth(deny) + Bun.stringWidth(gap),
        width: Bun.stringWidth(approve),
      },
    );
    this.#renderer.requestRender();
  }

  #handleResize = (): void => {
    this.render("resize");
  };

  #handleMouseDown(event: MouseEvent): void {
    const region = this.#actionRegions.find(
      (candidate) =>
        Math.trunc(event.y) === candidate.row &&
        Math.trunc(event.x) >= candidate.col &&
        Math.trunc(event.x) < candidate.col + candidate.width,
    );
    if (!region) {
      return;
    }
    event.preventDefault();
    if (region.action === "close") {
      this.#input.onQuit?.();
      return;
    }
    void this.#handleApprovalAction(region);
  }

  #handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    if ((key.ctrl && key.name === "q") || key.name === "escape") {
      key.preventDefault();
      this.#input.onQuit?.();
      return;
    }
    if (key.name === "a") {
      key.preventDefault();
      void this.#handleCurrentApproval("approve");
      return;
    }
    if (key.name === "d") {
      key.preventDefault();
      void this.#handleCurrentApproval("deny");
    }
  };

  async #handleCurrentApproval(action: "approve" | "deny"): Promise<void> {
    const request = resolvePendingTerminalApproval(this.#state, this.#input.terminalId);
    if (!request) {
      this.#statusNotice = "no pending approval";
      this.render("approval-missing");
      return;
    }
    await this.#handleApprovalAction({
      action,
      terminalId: request.terminalId,
      requestId: request.requestId,
      row: 0,
      col: 0,
      width: 0,
    });
  }

  async #handleApprovalAction(region: TopLayerActionRegion): Promise<void> {
    if (!region.terminalId || !region.requestId) {
      return;
    }
    this.#statusNotice = region.action === "approve" ? "approving terminal write..." : "denying terminal write...";
    this.render("approval-start");
    try {
      if (region.action === "approve") {
        await this.#input.store.approveGlobalTerminalRequest({
          terminalId: region.terminalId,
          requestId: region.requestId,
          durationMs: APPROVAL_LEASE_DURATION_MS,
        });
      } else {
        await this.#input.store.denyGlobalTerminalRequest({
          terminalId: region.terminalId,
          requestId: region.requestId,
        });
      }
      await this.#input.store.hydrateGlobalTerminalApprovals({
        terminalId: region.terminalId,
        force: true,
      });
      this.#statusNotice = region.action === "approve" ? "terminal write approved" : "terminal write denied";
      this.render("approval-finished");
    } catch (error) {
      this.#statusNotice = `approval failed: ${error instanceof Error ? error.message : String(error)}`;
      this.render("approval-error");
    }
  }
}

export const startCliShellTopLayerApp = async (
  input: CliShellTopLayerAppInput,
): Promise<{ app: CliShellTopLayerApp; renderer: CliRenderer }> => {
  const renderer = input.renderer ?? (await createCliRenderer({ exitOnCtrlC: false, useMouse: true }));
  const app = new CliShellTopLayerApp({
    ...input,
    renderer,
    ownsRenderer: input.renderer === undefined,
  });
  app.start();
  return { app, renderer };
};

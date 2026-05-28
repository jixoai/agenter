import { MouseButton, RGBA, TextAttributes, type FrameBufferOptions, type MouseEvent, type RenderContext } from "@opentui/core";
import type {
  TerminalHostPointerDispatchResult,
  TerminalHostPointerInput,
  TerminalRenderRichLine,
} from "@agenter/termless-core";
import type { TerminalTransportSelectionOverlay } from "@agenter/terminal-transport-protocol";
import { OpenComposeFrameRenderable } from "./frame-renderable";
import { fitTerminalText } from "./cell-width";
import type {
  OpenComposeSelectionRegion,
  OpenComposeSelectionSource,
  OpenComposeTerminalApprovalActionDetail,
  OpenComposeTerminalPermissionRequest,
  OpenComposeTerminalRequestPermissionsHandler,
} from "./types";

const OVERLAY_FG = RGBA.fromHex("#f8fafc");
const OVERLAY_MUTED_FG = RGBA.fromHex("#cbd5e1");
const OVERLAY_BORDER_FG = RGBA.fromHex("#60a5fa");
const OVERLAY_BG = RGBA.fromHex("#111827");
const OVERLAY_ACTION_BG = RGBA.fromHex("#1e293b");
const OVERLAY_APPROVE_BG = RGBA.fromHex("#166534");
const OVERLAY_DENY_BG = RGBA.fromHex("#7f1d1d");
const DEFAULT_APPROVAL_LEASE_DURATION_MS = 30 * 60 * 1000;

export type OpenComposeTerminalSelectionPointHandler = (point: { ownerId: string; row: number; col: number }) => boolean;
export type OpenComposeTerminalPointerHandler = (
  input: TerminalHostPointerInput,
) => TerminalHostPointerDispatchResult | undefined;

interface OpenComposeTerminalApprovalActionRegion {
  action: OpenComposeTerminalApprovalActionDetail["action"];
  requestId: string;
  terminalId: string;
  row: number;
  col: number;
  width: number;
}

export interface OpenComposeTerminalViewPermissionProjectionUpdate {
  terminalId?: string;
  permissionRequests?: readonly OpenComposeTerminalPermissionRequest[];
  onRequestPermissions?: OpenComposeTerminalRequestPermissionsHandler;
  onApprovalAction?: (detail: OpenComposeTerminalApprovalActionDetail) => void;
}

export interface OpenComposeTerminalViewOptions extends FrameBufferOptions {
  terminalId?: string;
  lines: readonly TerminalRenderRichLine[];
  permissionRequests?: readonly OpenComposeTerminalPermissionRequest[];
  onRequestPermissions?: OpenComposeTerminalRequestPermissionsHandler;
  onApprovalAction?: (detail: OpenComposeTerminalApprovalActionDetail) => void;
  focused?: boolean;
  selectionRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  selectionRegions?: readonly OpenComposeSelectionRegion[];
  selectionSources?: readonly OpenComposeSelectionSource[];
  selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
  onPointerDown?: OpenComposeTerminalPointerHandler;
  onPointerDrag?: OpenComposeTerminalPointerHandler;
  onPointerUp?: OpenComposeTerminalPointerHandler;
  onInteractionTrace?: ConstructorParameters<typeof OpenComposeFrameRenderable>[1]["onInteractionTrace"];
  onMouseDown?: OpenComposeFrameRenderable["onMouseDown"];
  onMouseDrag?: OpenComposeFrameRenderable["onMouseDrag"];
  onMouseDragEnd?: OpenComposeFrameRenderable["onMouseDragEnd"];
  onMouseUp?: OpenComposeFrameRenderable["onMouseUp"];
  onMouseScroll?: OpenComposeFrameRenderable["onMouseScroll"];
}

export class OpenComposeTerminalViewRenderable extends OpenComposeFrameRenderable {
  #terminalId: string | null;
  #permissionRequests: readonly OpenComposeTerminalPermissionRequest[];
  #onRequestPermissions?: OpenComposeTerminalRequestPermissionsHandler;
  #onApprovalAction?: (detail: OpenComposeTerminalApprovalActionDetail) => void;
  #permissionRequestHandlerFingerprints = new Map<string, string>();
  #customHandledPermissionRequestIds = new Set<string>();
  #approvalActionRegions: OpenComposeTerminalApprovalActionRegion[] = [];
  readonly #onPointerDown?: OpenComposeTerminalPointerHandler;
  readonly #onPointerDrag?: OpenComposeTerminalPointerHandler;
  readonly #onPointerUp?: OpenComposeTerminalPointerHandler;

  constructor(ctx: RenderContext, options: OpenComposeTerminalViewOptions) {
    super(ctx, options);
    this.#onPointerDown = options.onPointerDown;
    this.#onPointerDrag = options.onPointerDrag;
    this.#onPointerUp = options.onPointerUp;
    const userMouseDown = options.onMouseDown;
    const userMouseDrag = options.onMouseDrag;
    const userMouseDragEnd = options.onMouseDragEnd;
    const userMouseUp = options.onMouseUp;
    this.onMouseDown = (event) => {
      this.#dispatchPointer(this.#onPointerDown, event);
      userMouseDown?.(event);
    };
    this.onMouseDrag = (event) => {
      this.#dispatchPointer(this.#onPointerDrag, event);
      userMouseDrag?.(event);
    };
    this.onMouseDragEnd = (event) => {
      this.#dispatchPointer(this.#onPointerUp, event);
      userMouseDragEnd?.(event);
    };
    this.onMouseUp = (event) => {
      this.#dispatchPointer(this.#onPointerUp, event);
      userMouseUp?.(event);
    };
    this.#terminalId = options.terminalId ?? null;
    this.#permissionRequests = options.permissionRequests ?? [];
    this.#onRequestPermissions = options.onRequestPermissions;
    this.#onApprovalAction = options.onApprovalAction;
    this.syncPermissionRequests();
    this.repaintPermissionOverlay();
  }

  override updateProjection(update: Parameters<OpenComposeFrameRenderable["updateProjection"]>[0] & OpenComposeTerminalViewPermissionProjectionUpdate) {
    if ("terminalId" in update) {
      this.#terminalId = update.terminalId ?? null;
    }
    if ("permissionRequests" in update) {
      this.#permissionRequests = update.permissionRequests ?? [];
    }
    if ("onRequestPermissions" in update) {
      this.#onRequestPermissions = update.onRequestPermissions;
    }
    if ("onApprovalAction" in update) {
      this.#onApprovalAction = update.onApprovalAction;
    }
    this.syncPermissionRequests();
    const stats = super.updateProjection(update);
    this.paintPermissionOverlay();
    return stats;
  }

  private syncPermissionRequests(): void {
    const activeRequestIds = new Set(this.#permissionRequests.map((request) => request.requestId));
    for (const requestId of [...this.#permissionRequestHandlerFingerprints.keys()]) {
      if (!activeRequestIds.has(requestId)) {
        this.#permissionRequestHandlerFingerprints.delete(requestId);
        this.#customHandledPermissionRequestIds.delete(requestId);
      }
    }
    if (!this.#onRequestPermissions) {
      this.#permissionRequestHandlerFingerprints.clear();
      this.#customHandledPermissionRequestIds.clear();
      return;
    }
    const terminalId = this.#terminalId;
    if (!terminalId) {
      return;
    }
    for (const request of this.#permissionRequests) {
      if (request.terminalId !== terminalId) {
        continue;
      }
      const fingerprint = this.permissionRequestFingerprint(request);
      if (this.#permissionRequestHandlerFingerprints.get(request.requestId) === fingerprint) {
        continue;
      }
      this.#permissionRequestHandlerFingerprints.set(request.requestId, fingerprint);
      const handled = this.#onRequestPermissions({
        terminalId,
        request,
      });
      if (handled === true) {
        this.#customHandledPermissionRequestIds.add(request.requestId);
      } else {
        this.#customHandledPermissionRequestIds.delete(request.requestId);
      }
    }
  }

  protected override onResize(width: number, height: number): void {
    super.onResize(width, height);
    this.paintPermissionOverlay();
  }

  private permissionRequestFingerprint(request: OpenComposeTerminalPermissionRequest): string {
    return JSON.stringify({
      requestId: request.requestId,
      terminalId: request.terminalId,
      participantId: request.participantId,
      assignedAdminId: request.assignedAdminId,
      expiresAt: request.expiresAt,
      status: request.status,
      requestedInput: request.requestedInput,
      decidedAt: request.decidedAt,
      decidedBy: request.decidedBy,
      leaseId: request.leaseId,
    });
  }

  private resolveDefaultPermissionRequest(): OpenComposeTerminalPermissionRequest | null {
    const terminalId = this.#terminalId;
    if (!terminalId) {
      return null;
    }
    const requests = this.#permissionRequests.filter(
      (request) =>
        request.terminalId === terminalId && !this.#customHandledPermissionRequestIds.has(request.requestId),
    );
    return (
      requests.find((request) => request.status === "pending") ??
      requests.find((request) => request.status === "expired" || request.status === "denied") ??
      null
    );
  }

  private paintPermissionOverlay(): void {
    this.#approvalActionRegions = [];
    const request = this.resolveDefaultPermissionRequest();
    if (!request || this.width <= 0 || this.height <= 0) {
      return;
    }
    const overlayWidth = Math.max(20, Math.min(this.width, 58, Math.max(20, this.width - 4)));
    const overlayHeight = Math.max(5, Math.min(this.height, request.status === "pending" ? 7 : 5));
    const left = Math.max(0, Math.trunc((this.width - overlayWidth) / 2));
    const top = Math.max(0, Math.trunc((this.height - overlayHeight) / 2));
    const right = left + overlayWidth - 1;
    const bottom = top + overlayHeight - 1;

    this.drawOverlayLine(top, left, `+${"-".repeat(Math.max(0, overlayWidth - 2))}+`, OVERLAY_BORDER_FG);
    for (let row = top + 1; row < bottom; row += 1) {
      this.drawOverlayLine(row, left, `|${" ".repeat(Math.max(0, overlayWidth - 2))}|`, OVERLAY_MUTED_FG);
    }
    this.drawOverlayLine(bottom, left, `+${"-".repeat(Math.max(0, overlayWidth - 2))}+`, OVERLAY_BORDER_FG);

    const contentWidth = Math.max(0, overlayWidth - 4);
    const title = request.status === "pending" ? "Terminal write approval" : `Terminal request ${request.status}`;
    this.drawOverlayText(top + 1, left + 2, title, contentWidth, OVERLAY_FG, OVERLAY_BG, TextAttributes.BOLD);
    this.drawOverlayText(
      top + 2,
      left + 2,
      `${request.participantId} requests ${request.requestedInput?.mode ?? "input"} access`,
      contentWidth,
      OVERLAY_MUTED_FG,
      OVERLAY_BG,
    );
    this.drawOverlayText(
      top + 3,
      left + 2,
      request.requestedInput?.text ?? "(no input preview)",
      contentWidth,
      OVERLAY_FG,
      OVERLAY_BG,
    );

    if (request.status !== "pending" || overlayHeight < 7) {
      return;
    }
    const actionRow = bottom - 1;
    const denyLabel = "[ Deny ]";
    const approveLabel = "[ Approve ]";
    const approveCol = Math.max(left + 2, right - approveLabel.length - 2);
    const denyCol = Math.max(left + 2, approveCol - denyLabel.length - 2);
    this.drawOverlayText(actionRow, denyCol, denyLabel, denyLabel.length, OVERLAY_FG, OVERLAY_DENY_BG);
    this.drawOverlayText(actionRow, approveCol, approveLabel, approveLabel.length, OVERLAY_FG, OVERLAY_APPROVE_BG);
    this.#approvalActionRegions = [
      {
        action: "deny",
        requestId: request.requestId,
        terminalId: request.terminalId,
        row: actionRow,
        col: denyCol,
        width: denyLabel.length,
      },
      {
        action: "approve",
        requestId: request.requestId,
        terminalId: request.terminalId,
        row: actionRow,
        col: approveCol,
        width: approveLabel.length,
      },
    ];
  }

  private repaintPermissionOverlay(): void {
    super.paintBackendFrame();
    this.paintPermissionOverlay();
    this.requestRender();
  }

  private drawOverlayLine(row: number, col: number, text: string, fg: RGBA): void {
    if (row < 0 || row >= this.height || col >= this.width) {
      return;
    }
    this.frameBuffer.drawText(
      fitTerminalText(text, Math.max(0, Math.min(this.width - col, text.length))),
      col,
      row,
      fg,
      OVERLAY_BG,
    );
  }

  private drawOverlayText(
    row: number,
    col: number,
    text: string,
    width: number,
    fg: RGBA,
    bg: RGBA,
    attributes = TextAttributes.NONE,
  ): void {
    if (row < 0 || row >= this.height || col >= this.width || width <= 0) {
      return;
    }
    const safeWidth = Math.max(0, Math.min(width, this.width - col));
    if (safeWidth <= 0) {
      return;
    }
    this.frameBuffer.drawText(fitTerminalText(text, safeWidth, { ellipsis: true }), col, row, fg, bg, attributes);
  }

  private handlePermissionMouseDown(event: MouseEvent): boolean {
    if (event.button !== MouseButton.LEFT) {
      return false;
    }
    const localX = Math.trunc(event.x - this.x);
    const localY = Math.trunc(event.y - this.y);
    const region = this.#approvalActionRegions.find(
      (candidate) =>
        localY === candidate.row &&
        localX >= candidate.col &&
        localX < candidate.col + candidate.width,
    );
    if (!region) {
      return false;
    }
    this.#onApprovalAction?.({
      terminalId: region.terminalId,
      requestId: region.requestId,
      action: region.action,
      durationMs: DEFAULT_APPROVAL_LEASE_DURATION_MS,
    });
    event.preventDefault();
    return true;
  }

  override processMouseEvent(event: MouseEvent): void {
    if (event.type === "down" && this.handlePermissionMouseDown(event)) {
      event.stopPropagation();
      return;
    }
    super.processMouseEvent(event);
  }

  #dispatchPointer(handler: OpenComposeTerminalPointerHandler | undefined, event: MouseEvent): void {
    if (!handler) {
      return;
    }
    const point = this.eventToOwnerCoordinate(event, null);
    const result = handler({
      button: this.#resolvePointerButton(event.button),
      point,
      clickCount: this.#readClickCount(event),
      timestampMs: performance.now(),
    });
    if (result?.preventDefault) {
      event.preventDefault();
    }
  }

  #resolvePointerButton(button: number): TerminalHostPointerInput["button"] {
    if (button === MouseButton.LEFT) {
      return "left";
    }
    if (button === MouseButton.MIDDLE) {
      return "middle";
    }
    if (button === MouseButton.RIGHT) {
      return "right";
    }
    return "unknown";
  }

  #readClickCount(event: MouseEvent): number | undefined {
    const candidate = event as unknown as { clickCount?: unknown; detail?: unknown };
    const value = typeof candidate.clickCount === "number" ? candidate.clickCount : candidate.detail;
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return undefined;
    }
    return Math.max(1, Math.trunc(value));
  }
}

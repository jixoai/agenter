import { MouseButton, RGBA, TextAttributes, type FrameBufferOptions, type MouseEvent, type RenderContext } from "@opentui/core";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import type { TerminalTransportSelectionOverlay } from "@agenter/terminal-transport-protocol";

import { BackendFrameRenderable } from "./backend-frame-renderable";
import { fitTerminalText } from "./cell-width";
import type { CliShellInteractionEnhancementProfile } from "./interaction-capabilities";
import type {
  CliShellSelectionRegion,
  CliShellSelectionSource,
  CliShellTerminalApprovalActionDetail,
  CliShellTerminalPermissionRequest,
  CliShellTerminalRequestPermissionsHandler,
} from "./types";

const OVERLAY_FG = RGBA.fromHex("#f8fafc");
const OVERLAY_MUTED_FG = RGBA.fromHex("#cbd5e1");
const OVERLAY_BORDER_FG = RGBA.fromHex("#60a5fa");
const OVERLAY_BG = RGBA.fromHex("#111827");
const OVERLAY_ACTION_BG = RGBA.fromHex("#1e293b");
const OVERLAY_APPROVE_BG = RGBA.fromHex("#166534");
const OVERLAY_DENY_BG = RGBA.fromHex("#7f1d1d");
const DEFAULT_APPROVAL_LEASE_DURATION_MS = 30 * 60 * 1000;

interface ShellTerminalApprovalActionRegion {
  action: CliShellTerminalApprovalActionDetail["action"];
  requestId: string;
  terminalId: string;
  row: number;
  col: number;
  width: number;
}

export interface ShellTerminalViewPermissionProjectionUpdate {
  terminalId?: string;
  permissionRequests?: readonly CliShellTerminalPermissionRequest[];
  onRequestPermissions?: CliShellTerminalRequestPermissionsHandler;
  onApprovalAction?: (detail: CliShellTerminalApprovalActionDetail) => void;
}

export interface ShellTerminalViewOptions extends FrameBufferOptions {
  terminalId?: string;
  lines: readonly TerminalRenderRichLine[];
  permissionRequests?: readonly CliShellTerminalPermissionRequest[];
  onRequestPermissions?: CliShellTerminalRequestPermissionsHandler;
  onApprovalAction?: (detail: CliShellTerminalApprovalActionDetail) => void;
  focused?: boolean;
  selectionRegion?: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  selectionRegions?: readonly CliShellSelectionRegion[];
  selectionSources?: readonly CliShellSelectionSource[];
  selectionOverlays?: readonly TerminalTransportSelectionOverlay[];
  interactionProfile?: CliShellInteractionEnhancementProfile;
  semanticClickMaxDistanceCells?: number;
  onSelectionStart?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectionStart"];
  onSelectionUpdate?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectionUpdate"];
  onSelectionEnd?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectionEnd"];
  onSelectWordAt?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectWordAt"];
  onSelectLineAt?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onSelectLineAt"];
  onClearSelection?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onClearSelection"];
  onInteractionTrace?: ConstructorParameters<typeof BackendFrameRenderable>[1]["onInteractionTrace"];
  onMouseDown?: BackendFrameRenderable["onMouseDown"];
  onMouseDrag?: BackendFrameRenderable["onMouseDrag"];
  onMouseDragEnd?: BackendFrameRenderable["onMouseDragEnd"];
  onMouseUp?: BackendFrameRenderable["onMouseUp"];
  onMouseScroll?: BackendFrameRenderable["onMouseScroll"];
}

export class ShellTerminalViewRenderable extends BackendFrameRenderable {
  #terminalId: string | null;
  #permissionRequests: readonly CliShellTerminalPermissionRequest[];
  #onRequestPermissions?: CliShellTerminalRequestPermissionsHandler;
  #onApprovalAction?: (detail: CliShellTerminalApprovalActionDetail) => void;
  #permissionRequestHandlerFingerprints = new Map<string, string>();
  #customHandledPermissionRequestIds = new Set<string>();
  #approvalActionRegions: ShellTerminalApprovalActionRegion[] = [];

  constructor(ctx: RenderContext, options: ShellTerminalViewOptions) {
    super(ctx, options);
    this.#terminalId = options.terminalId ?? null;
    this.#permissionRequests = options.permissionRequests ?? [];
    this.#onRequestPermissions = options.onRequestPermissions;
    this.#onApprovalAction = options.onApprovalAction;
    this.syncPermissionRequests();
    this.repaintPermissionOverlay();
  }

  override updateProjection(update: Parameters<BackendFrameRenderable["updateProjection"]>[0] & ShellTerminalViewPermissionProjectionUpdate) {
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

  private permissionRequestFingerprint(request: CliShellTerminalPermissionRequest): string {
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

  private resolveDefaultPermissionRequest(): CliShellTerminalPermissionRequest | null {
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
}

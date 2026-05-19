import {
  applyTerminalFramePatch,
  createTerminalTransportRowCacheDecoder,
  decodeTerminalTransportServerMessage,
  encodeTerminalTransportClientMessage,
  type TerminalTransportClientMessage,
  type TerminalTransportFramePayload,
  type TerminalTransportRowCacheDecoder,
  type TerminalTransportServerMessage,
} from "@agenter/terminal-transport-protocol";
import { LitElement, html } from "lit";
import { property, query } from "lit/decorators.js";

import {
  DEFAULT_TERMINAL_CURSOR,
  DEFAULT_TERMINAL_FONT,
  DEFAULT_TERMINAL_RENDERER_PREFERENCE,
  DEFAULT_TERMINAL_THEME,
  resolveTerminalAppearance,
  resolveTerminalRenderer,
  type ResolvedTerminalAppearance,
  type TerminalCursorStyle,
  type TerminalFontProfile,
  type TerminalRendererPreference,
  type TerminalResolvedRenderer,
  type TerminalThemeName,
} from "./terminal-renderer-profile";
import { resolveTerminalRendererAdapter, resolveTerminalRendererStyles } from "./terminal-renderer-registry";
import type {
  TerminalPresentationMutationField,
  TerminalRendererAdapter,
  TerminalRendererSession,
} from "./terminal-renderer-adapter";
import { TERMINAL_PUBLIC_SCREEN_ATTRIBUTE, TERMINAL_PUBLIC_SCROLL_ATTRIBUTE } from "./terminal-renderer-adapter";
import { resolveTerminalScreenMetrics } from "./terminal-geometry";
import type {
  TerminalViewConnectionState,
  TerminalViewApprovalActionDetail,
  TerminalViewGeometryAuthorityDetail,
  TerminalViewGeometryRole,
  TerminalViewPermissionRequest,
  TerminalViewPermissionRequestDetail,
  TerminalViewPresentationReadyDetail,
  TerminalViewPresentationSettleReason,
  TerminalViewRequestPermissionsHandler,
  TerminalViewScreenMetrics,
  TerminalViewSnapshot,
} from "./terminal-view-types";

export const TERMINAL_VIEW_TAG = "terminal-view";

const FALLBACK_LINE_HEIGHT = 16;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const DEFAULT_SCROLLBACK = 10_000;
const utf8Encoder = new TextEncoder();
const MAX_TEXT_EVIDENCE_LENGTH = 200_000;
const TERMINAL_TEXT_EVIDENCE_ATTRIBUTE = "data-terminal-text-evidence";

const templateStyles = `
  :host {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .terminal-stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    min-width: 0;
    overflow: hidden;
  }

  .terminal-frame-shell {
    position: relative;
    overflow: hidden;
  }

  .terminal-frame {
    position: relative;
    overflow: hidden;
  }

  .terminal-screen {
    overflow: hidden;
    font-variant-ligatures: normal;
    font-feature-settings: "liga" 1, "calt" 1;
    text-rendering: optimizeLegibility;
  }

  .terminal-permission-popover {
    box-sizing: border-box;
    width: min(420px, calc(100vw - 32px));
    border: 1px solid rgba(148, 163, 184, 0.34);
    border-radius: 8px;
    padding: 12px;
    background: rgba(15, 23, 42, 0.96);
    color: #f8fafc;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.34);
    font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .terminal-permission-popover::backdrop {
    background: transparent;
  }

  .terminal-permission-title {
    margin: 0 0 6px;
    font-size: 13px;
    font-weight: 650;
  }

  .terminal-permission-meta,
  .terminal-permission-status {
    margin: 0;
    color: rgba(226, 232, 240, 0.72);
    font-size: 12px;
  }

  .terminal-permission-preview {
    margin: 10px 0;
    max-height: 120px;
    overflow: auto;
    white-space: pre-wrap;
    border-radius: 6px;
    background: rgba(2, 6, 23, 0.78);
    padding: 8px;
    font: 12px/1.45 ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }

  .terminal-permission-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .terminal-permission-button {
    min-width: 74px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 6px;
    padding: 6px 10px;
    background: rgba(30, 41, 59, 0.92);
    color: #e2e8f0;
    font: inherit;
    cursor: pointer;
  }

  .terminal-permission-button[data-action="approve"] {
    border-color: rgba(34, 197, 94, 0.38);
    background: rgba(22, 101, 52, 0.92);
    color: #dcfce7;
  }
`;

const toOwnedArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
};

const ANSI_RESET = "\u001b[0m";

const hexToRgb = (input: string): [number, number, number] | null => {
  const normalized = input.trim();
  const match = /^#(?<hex>[0-9a-f]{6})$/i.exec(normalized);
  if (!match?.groups?.hex) {
    return null;
  }
  const value = match.groups.hex;
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
};

const toAnsiColor = (prefix: "38" | "48", color: string | undefined): string | null => {
  if (!color) {
    return null;
  }
  const rgb = hexToRgb(color);
  if (!rgb) {
    return null;
  }
  return `${prefix};2;${rgb[0]};${rgb[1]};${rgb[2]}`;
};

const serializeRichSpan = (span: NonNullable<TerminalViewSnapshot["richLines"]>[number]["spans"][number]): string => {
  const codes = [
    span.bold ? "1" : null,
    span.underline ? "4" : null,
    span.inverse ? "7" : null,
    toAnsiColor("38", span.fg),
    toAnsiColor("48", span.bg),
  ].filter((value): value is string => value !== null);

  if (codes.length === 0) {
    return span.text;
  }
  return `\u001b[${codes.join(";")}m${span.text}${ANSI_RESET}`;
};

const serializeSnapshot = (snapshot: TerminalViewSnapshot): string => {
  if (snapshot.richLines && snapshot.richLines.length > 0) {
    return snapshot.richLines
      .map((line: NonNullable<TerminalViewSnapshot["richLines"]>[number]) =>
        line.spans.map((span: NonNullable<TerminalViewSnapshot["richLines"]>[number]["spans"][number]) => serializeRichSpan(span)).join(""),
      )
      .join("\r\n");
  }
  return snapshot.lines.join("\r\n");
};

const resolveSnapshotScrollback = (snapshot: TerminalViewSnapshot): number =>
  Math.max(DEFAULT_SCROLLBACK, snapshot.scrollback.totalLines + 256);

const stripTerminalControlText = (value: string): string =>
  value
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/gu, "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(/\u001b[@-_]/gu, "")
    .replace(/[^\P{Cc}\n\t]/gu, "");

export class TerminalViewElement extends LitElement {
  static override shadowRootOptions = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
  };

  @property({ attribute: "transport-url" }) accessor transportUrl = "";
  @property({ attribute: "live-transport-enabled", type: Boolean }) accessor liveTransportEnabled = true;
  @property({ attribute: "terminal-id" }) accessor terminalId = "";
  @property({ attribute: false }) accessor snapshot: TerminalViewSnapshot | null = null;
  @property({ attribute: false }) accessor connectionState: TerminalViewConnectionState = "idle";
  @property({ attribute: false }) accessor errorMessage = "";
  @property({ attribute: "renderer-preference" }) accessor rendererPreference: TerminalRendererPreference =
    DEFAULT_TERMINAL_RENDERER_PREFERENCE;
  @property({ attribute: "theme-name" }) accessor theme: TerminalThemeName = DEFAULT_TERMINAL_THEME;
  @property({ attribute: "cursor-style" }) accessor cursor: TerminalCursorStyle = DEFAULT_TERMINAL_CURSOR;
  @property({ attribute: false }) accessor font: TerminalFontProfile = { ...DEFAULT_TERMINAL_FONT };
  @property({ attribute: false }) accessor resolvedRenderer: TerminalResolvedRenderer | null = null;
  @property({ attribute: false }) accessor rendererReason = "";
  @property({ attribute: false }) accessor screenMetrics: TerminalViewScreenMetrics | null = null;
  @property({ attribute: "geometry-role" }) accessor geometryRole: TerminalViewGeometryRole = "projection-only";
  @property({ attribute: "geometry-order", type: Number }) accessor geometryOrder: number | undefined = undefined;
  @property({ attribute: false }) accessor effectiveGeometryRole: TerminalViewGeometryRole = "projection-only";
  @property({ attribute: false }) accessor transportAttachmentId = "";
  @property({ attribute: false }) accessor geometryAuthorityAttachmentId = "";
  @property({ attribute: false }) accessor geometryAuthorityReason = "";
  @property({ attribute: "projection-width", type: Number }) accessor projectionWidth = 0;
  @property({ attribute: "projection-height", type: Number }) accessor projectionHeight = 0;
  @property({ attribute: "projection-scale", type: Number }) accessor projectionScale = 1;
  @property({ attribute: "projection-offset-x", type: Number }) accessor projectionOffsetX = 0;
  @property({ attribute: "projection-offset-y", type: Number }) accessor projectionOffsetY = 0;
  @property({ attribute: false }) accessor permissionRequests: TerminalViewPermissionRequest[] = [];
  @property({ attribute: false }) accessor onRequestPermissions: TerminalViewRequestPermissionsHandler | null = null;

  @query("[data-terminal-stage]") private accessor stageHost!: HTMLDivElement;
  @query("[data-terminal-viewport]") private accessor viewportHost!: HTMLDivElement;
  @query("[data-terminal-permission-popover]") private accessor permissionPopover!: HTMLElement;

  private terminalSession: TerminalRendererSession | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private socket: WebSocket | null = null;
  private latestLiveFrame: TerminalTransportFramePayload | null = null;
  private rowCacheDecoder: TerminalTransportRowCacheDecoder = createTerminalTransportRowCacheDecoder();
  private hydratedSnapshotSeq = -1;
  private liveSnapshotHydrated = false;
  private dirtyFrameSeq = 0;
  private observedFrameSeq = 0;
  private pullFrameInFlight = false;
  private pullFrameTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPullFrameAt = 0;
  private pullDueNow = false;
  private lastAppliedViewportStart: number | null = null;
  private lastSentResize: { cols: number; rows: number } | null = null;
  private stageWidth = 0;
  private stageHeight = 0;
  private screenWidth = 0;
  private screenHeight = 0;
  private firstUpdateFramePending = false;
  private stageResizeFrame = 0;
  private viewportInteractionDisposers: Array<() => void> = [];
  private rendererScrollInteractionDisposers: Array<() => void> = [];
  private boundRendererScrollSurface: HTMLElement | null = null;
  private rendererScrollSyncSuppressed = false;
  private rendererScrollSyncReleaseFrame = 0;
  private activeAppearanceKey = "";
  private lastResolvedAppearance: ResolvedTerminalAppearance | null = null;
  private rendererErrorMessage = "";
  private rendererSetupToken = 0;
  private textEvidenceBuffer = "";
  private textEvidenceNode: HTMLSpanElement | null = null;
  private pendingTerminalFocus = false;
  private lastResolvedRendererPreference: TerminalRendererPreference = DEFAULT_TERMINAL_RENDERER_PREFERENCE;
  private permissionRequestHandlerFingerprints = new Map<string, string>();
  private customHandledPermissionRequestIds = new Set<string>();

  // Canvas-first renderers such as ghostty-web do not surface visible terminal text
  // through DOM nodes. Keep one renderer-neutral text evidence surface for host probes
  // and end-to-end verification instead of falling back to renderer-private selectors.
  public get textEvidence(): string {
    return this.textEvidenceBuffer;
  }

  public override focus(options?: FocusOptions): void {
    this.pendingTerminalFocus = true;
    super.focus(options);
    this.focusTerminalInput();
  }

  public requestViewportResize(input: { cols: number; rows: number }): boolean {
    const cols = Math.max(1, Math.floor(input.cols));
    const rows = Math.max(1, Math.floor(input.rows));
    if (!Number.isFinite(cols) || !Number.isFinite(rows)) {
      return false;
    }
    if (
      this.sendClientMessage({
        type: "resize",
        cols,
        rows,
      })
    ) {
      this.dirtyFrameSeq = Math.max(this.dirtyFrameSeq, this.observedFrameSeq + 1);
      this.pullDueNow = true;
      this.lastSentResize = { cols, rows };
      this.schedulePullFrame();
      return true;
    }
    return false;
  }

  public requestViewportDelta(input: { deltaRows: number }): boolean {
    const deltaRows = Math.trunc(input.deltaRows);
    if (!Number.isFinite(deltaRows) || deltaRows === 0) {
      return false;
    }
    return this.withSuppressedRendererScrollSync(() => {
      return this.sendClientMessage({
        type: "viewportDelta",
        deltaRows,
      });
    });
  }

  public requestViewportTarget(input: { viewportStart: number }): boolean {
    const viewportStart = Math.max(0, Math.trunc(input.viewportStart));
    if (!Number.isFinite(viewportStart)) {
      return false;
    }
    return this.sendClientMessage({
      type: "viewportTarget",
      viewportStart,
    });
  }

  private scheduleAfterUpdate(callback: () => void): void {
    const run = () => {
      if (!this.isConnected) {
        return;
      }
      callback();
    };

    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => run());
      return;
    }

    setTimeout(run, 0);
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.hasAttribute("tabindex")) {
      this.tabIndex = 0;
    }
    this.ensureTextEvidenceNode();
    this.upgradeProperty("transportUrl");
    this.upgradeProperty("liveTransportEnabled");
    this.upgradeProperty("terminalId");
    this.upgradeProperty("snapshot");
    this.upgradeProperty("rendererPreference");
    this.upgradeProperty("theme");
    this.upgradeProperty("cursor");
    this.upgradeProperty("font");
    this.upgradeProperty("geometryRole");
    this.upgradeProperty("geometryOrder");
    this.upgradeProperty("projectionWidth");
    this.upgradeProperty("projectionHeight");
    this.upgradeProperty("projectionScale");
    this.upgradeProperty("projectionOffsetX");
    this.upgradeProperty("projectionOffsetY");
    this.upgradeProperty("permissionRequests");
    this.upgradeProperty("onRequestPermissions");
    this.syncSocket();
  }

  disconnectedCallback(): void {
    this.disconnectSocket();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    for (const dispose of this.viewportInteractionDisposers) {
      dispose();
    }
    this.viewportInteractionDisposers = [];
    this.clearRendererScrollSurfaceBindings();
    if (this.stageResizeFrame !== 0) {
      cancelAnimationFrame(this.stageResizeFrame);
      this.stageResizeFrame = 0;
    }
    if (this.rendererScrollSyncReleaseFrame !== 0) {
      cancelAnimationFrame(this.rendererScrollSyncReleaseFrame);
      this.rendererScrollSyncReleaseFrame = 0;
    }
    this.disposeRendererSession();
    super.disconnectedCallback();
  }

  firstUpdated(): void {
    if (this.firstUpdateFramePending) {
      return;
    }
    this.firstUpdateFramePending = true;
    this.scheduleAfterUpdate(() => {
      this.firstUpdateFramePending = false;
      this.ensureRendererSession();
      this.observeStage();
    });
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has("snapshot")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.hydrateSnapshot(this.snapshot, "prop");
      });
    }
    if (changed.has("transportUrl") || changed.has("liveTransportEnabled")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.syncSocket();
      });
    }
    if (changed.has("geometryRole") || changed.has("geometryOrder")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.syncGeometryAuthorityHandshake();
      });
    }
    if (changed.has("rendererPreference") || changed.has("theme") || changed.has("cursor") || changed.has("font")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.ensureRendererSession();
      });
    }
    if (changed.has("permissionRequests") || changed.has("onRequestPermissions") || changed.has("terminalId")) {
      queueMicrotask(() => {
        if (!this.isConnected) {
          return;
        }
        this.syncPermissionRequests();
      });
    }
  }

  render() {
    const cols = this.snapshot?.cols ?? this.terminalSession?.cols ?? DEFAULT_COLS;
    const rows = this.snapshot?.rows ?? this.terminalSession?.rows ?? DEFAULT_ROWS;
    const screenWidth = this.screenWidth > 0 ? this.screenWidth : undefined;
    const screenHeight = this.screenHeight > 0 ? this.screenHeight : Math.round(rows * FALLBACK_LINE_HEIGHT);
    const screenMetrics = resolveTerminalScreenMetrics({
      cols,
      rows,
      screenWidth,
      screenHeight,
    });
    const frameWidth = screenMetrics.frameWidth;
    const frameHeight = screenMetrics.frameHeight;
    const projectionScale = Number.isFinite(this.projectionScale) && this.projectionScale > 0 ? this.projectionScale : 1;
    const projectionWidth =
      Number.isFinite(this.projectionWidth) && this.projectionWidth > 0 ? this.projectionWidth : Math.round(frameWidth * projectionScale);
    const projectionHeight =
      Number.isFinite(this.projectionHeight) && this.projectionHeight > 0 ? this.projectionHeight : Math.round(frameHeight * projectionScale);
    const projectionOffsetX = Number.isFinite(this.projectionOffsetX) ? this.projectionOffsetX : 0;
    const projectionOffsetY = Number.isFinite(this.projectionOffsetY) ? this.projectionOffsetY : 0;
    const appearance = this.resolveAppearance();
    const rendererStyles = resolveTerminalRendererStyles(this.resolveRendererState().resolvedRenderer);
    const combinedStyles = `${rendererStyles}\n${templateStyles}`;
    const permissionRequest = this.resolveDefaultPermissionRequest();

    return html`
      <style>
        ${combinedStyles}
      </style>
      <div
        class="terminal-stage"
        data-terminal-stage
        data-terminal-scroll-contract="terminal-stage"
        data-terminal-scroll-owner="terminal-stage"
        data-terminal-renderer-preference=${this.rendererPreference}
        data-terminal-resolved-renderer=${this.resolvedRenderer ?? ""}
        style=${`width:${projectionWidth}px;height:${projectionHeight}px;`}
      >
        <div class="terminal-frame-shell" style=${`width:${projectionWidth}px;height:${projectionHeight}px;`}>
          <section
            class="terminal-frame"
            data-terminal-view-root="true"
            style=${`width:${frameWidth}px;height:${frameHeight}px;transform:translate(${projectionOffsetX}px, ${projectionOffsetY}px) scale(${projectionScale});transform-origin:top left;`}
          >
            <div
              class="terminal-screen"
              data-terminal-viewport
              data-terminal-theme=${appearance.themeName}
              style=${`width:${screenMetrics.screenWidth}px;height:${screenMetrics.screenHeight}px;margin-left:${screenMetrics.framePaddingX}px;margin-top:${screenMetrics.framePaddingY}px;background:${appearance.theme.background};color:${appearance.theme.foreground};`}
            ></div>
          </section>
        </div>
      </div>
      ${permissionRequest ? this.renderPermissionPopover(permissionRequest) : null}
    `;
  }

  private resolveRendererState() {
    return resolveTerminalRenderer(this.rendererPreference);
  }

  private resolveAppearance(): ResolvedTerminalAppearance {
    return resolveTerminalAppearance({
      theme: this.theme,
      cursor: this.cursor,
      font: this.font,
    });
  }

  private resolvePresentationMutationRequirement(input: {
    adapter: TerminalRendererAdapter;
    previousAppearance: ResolvedTerminalAppearance | null;
    nextAppearance: ResolvedTerminalAppearance;
    previousRendererPreference: TerminalRendererPreference;
    nextRendererPreference: TerminalRendererPreference;
  }): {
    fields: TerminalPresentationMutationField[];
    requiresRebuild: boolean;
    reason: TerminalViewPresentationSettleReason;
  } {
    const fields: TerminalPresentationMutationField[] = [];
    if (!input.previousAppearance || input.previousAppearance.themeName !== input.nextAppearance.themeName) {
      fields.push("theme");
    }
    if (!input.previousAppearance || input.previousAppearance.cursorStyle !== input.nextAppearance.cursorStyle) {
      fields.push("cursor");
    }
    if (!input.previousAppearance || JSON.stringify(input.previousAppearance.font) !== JSON.stringify(input.nextAppearance.font)) {
      fields.push("font");
    }
    if (input.previousRendererPreference !== input.nextRendererPreference) {
      // Preference is durable truth even when auto resolves to the same renderer. Hosts still need
      // a settled fact, so a pure preference change becomes a stable-session ack when no field changed.
      if (fields.length === 0) {
        return {
          fields,
          requiresRebuild: false,
          reason: "stable-session",
        };
      }
    }
    const requiresRebuild = fields.some((field) => input.adapter.presentationMutationPolicy[field] === "rebuild-session");
    return {
      fields,
      requiresRebuild,
      reason: fields.length === 0 ? "stable-session" : requiresRebuild ? "rebuild-session" : "live-apply",
    };
  }

  private dispatchPresentationReady(reason: TerminalViewPresentationSettleReason): void {
    if (!this.resolvedRenderer) {
      return;
    }
    const detail: TerminalViewPresentationReadyDetail = {
      terminalId: this.terminalId,
      resolvedRenderer: this.resolvedRenderer,
      reason,
      screenMetrics: this.screenMetrics,
    };
    this.dispatchEvent(
      new CustomEvent<TerminalViewPresentationReadyDetail>("terminal-view-presentation-ready", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private ensureRendererSession(): void {
    if (!this.viewportHost) {
      return;
    }
    void this.ensureRendererSessionAsync();
  }

  private async ensureRendererSessionAsync(): Promise<void> {
    if (!this.viewportHost) {
      return;
    }
    const resolution = this.resolveRendererState();
    const adapter = resolveTerminalRendererAdapter(resolution.resolvedRenderer);
    const appearance = this.resolveAppearance();
    const appearanceKey = JSON.stringify({
      themeName: appearance.themeName,
      cursorStyle: appearance.cursorStyle,
      font: appearance.font,
    });
    const currentCols = this.snapshot?.cols ?? this.terminalSession?.cols ?? DEFAULT_COLS;
    const currentRows = this.snapshot?.rows ?? this.terminalSession?.rows ?? DEFAULT_ROWS;
    const mutationRequirement =
      adapter && this.terminalSession?.resolvedRenderer === resolution.resolvedRenderer
        ? this.resolvePresentationMutationRequirement({
            adapter,
            previousAppearance: this.lastResolvedAppearance,
            nextAppearance: appearance,
            previousRendererPreference: this.lastResolvedRendererPreference,
            nextRendererPreference: this.rendererPreference,
          })
        : {
            fields: [] as TerminalPresentationMutationField[],
            requiresRebuild: this.terminalSession?.resolvedRenderer !== resolution.resolvedRenderer,
            reason: this.terminalSession ? ("rebuild-session" as const) : ("initial-session-ready" as const),
          };
    const requiresRebuild =
      this.terminalSession?.resolvedRenderer !== resolution.resolvedRenderer || mutationRequirement.requiresRebuild;

    if (requiresRebuild) {
      this.disposeRendererSession();
    }

    if (!this.terminalSession) {
      if (!adapter) {
        this.resolvedRenderer = resolution.resolvedRenderer;
        this.rendererReason = resolution.reason;
        this.rendererErrorMessage = `renderer '${resolution.resolvedRenderer}' is not available in terminal-view`;
        this.connectionState = "error";
        this.errorMessage = this.rendererErrorMessage;
        return;
      }
      const setupToken = ++this.rendererSetupToken;
      try {
        await adapter.ensureReady?.();
      } catch (error) {
        if (setupToken !== this.rendererSetupToken) {
          return;
        }
        this.resolvedRenderer = resolution.resolvedRenderer;
        this.rendererReason = resolution.reason;
        this.rendererErrorMessage =
          error instanceof Error ? error.message : `failed to prepare renderer '${resolution.resolvedRenderer}'`;
        this.connectionState = "error";
        this.errorMessage = this.rendererErrorMessage;
        return;
      }
      if (setupToken !== this.rendererSetupToken) {
        return;
      }
      this.rendererErrorMessage = "";
      this.terminalSession = await adapter.createSession({
        host: this.viewportHost,
        cols: currentCols,
        rows: currentRows,
        scrollback: DEFAULT_SCROLLBACK,
        appearance,
        onInputBytes: (data) => {
          this.sendClientMessage({
            type: "inputBytes",
            data,
          });
        },
      });
      this.activeAppearanceKey = appearanceKey;
      this.lastResolvedAppearance = appearance;
      this.lastResolvedRendererPreference = this.rendererPreference;
      this.resolvedRenderer = resolution.resolvedRenderer;
      this.rendererReason = resolution.reason;
      this.bindViewportInteractionFocus();
      this.bindRendererScrollSurface();
      this.syncMeasuredScreen();
      if (this.pendingTerminalFocus || this.ownerDocument.activeElement === this) {
        this.focusTerminalInput();
      }
      if (this.snapshot) {
        const source = this.connectionState === "connected" ? "renderer" : "prop";
        const applied = this.hydrateSnapshot(this.snapshot, source, { force: true });
        if (source === "renderer" && applied) {
          this.liveSnapshotHydrated = true;
        }
      }
      await this.terminalSession.settlePresentation?.();
      this.bindRendererScrollSurface();
      this.syncMeasuredScreen();
      this.dispatchPresentationReady(requiresRebuild ? "rebuild-session" : "initial-session-ready");
      return;
    }

    this.resolvedRenderer = resolution.resolvedRenderer;
    this.rendererReason = resolution.reason;
    if (this.activeAppearanceKey !== appearanceKey) {
      this.terminalSession.applyAppearance(appearance);
      await this.terminalSession.settlePresentation?.();
      this.bindRendererScrollSurface();
      this.activeAppearanceKey = appearanceKey;
      this.lastResolvedAppearance = appearance;
      this.lastResolvedRendererPreference = this.rendererPreference;
      this.syncMeasuredScreen();
      this.dispatchPresentationReady(mutationRequirement.reason);
      return;
    }
    if (this.lastResolvedRendererPreference !== this.rendererPreference) {
      this.lastResolvedRendererPreference = this.rendererPreference;
      this.dispatchPresentationReady("stable-session");
    }
  }

  private disposeRendererSession(): void {
    this.rendererSetupToken += 1;
    this.clearRendererScrollSurfaceBindings();
    this.terminalSession?.dispose();
    this.terminalSession = null;
    this.rowCacheDecoder.reset();
    this.resolvedRenderer = null;
    this.rendererReason = "";
    this.activeAppearanceKey = "";
    this.lastResolvedAppearance = null;
    this.lastAppliedViewportStart = null;
  }

  private upgradeProperty(
    name:
      | "transportUrl"
      | "liveTransportEnabled"
      | "terminalId"
      | "snapshot"
      | "rendererPreference"
      | "theme"
      | "cursor"
      | "font"
      | "geometryRole"
      | "geometryOrder"
      | "projectionWidth"
      | "projectionHeight"
      | "projectionScale"
      | "projectionOffsetX"
      | "projectionOffsetY"
      | "permissionRequests"
      | "onRequestPermissions"
      | "screenMetrics",
  ): void {
    if (!Object.prototype.hasOwnProperty.call(this, name)) {
      return;
    }
    const value = (this as Record<string, unknown>)[name];
    delete (this as Record<string, unknown>)[name];
    (this as Record<string, unknown>)[name] = value;
  }

  private observeStage(): void {
    if (this.resizeObserver || !this.stageHost || typeof ResizeObserver === "undefined") {
      return;
    }

    const updateStageSize = (width: number, height: number) => {
      if (width === this.stageWidth && height === this.stageHeight) {
        return;
      }
      this.stageWidth = width;
      this.stageHeight = height;
      this.requestUpdate();
    };

    const scheduleStageCommit = (width: number, height: number) => {
      if (this.stageResizeFrame !== 0) {
        cancelAnimationFrame(this.stageResizeFrame);
      }
      this.stageResizeFrame = requestAnimationFrame(() => {
        this.stageResizeFrame = 0;
        updateStageSize(width, height);
      });
    };

    const rect = this.stageHost.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      scheduleStageCommit(rect.width, rect.height);
    }

    this.resizeObserver = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect;
      if (!next) {
        return;
      }
      scheduleStageCommit(next.width, next.height);
    });
    this.resizeObserver.observe(this.stageHost);
  }

  private bindViewportInteractionFocus(): void {
    if (!this.viewportHost || this.viewportInteractionDisposers.length > 0) {
      return;
    }

    const focusTerminalInput = (): void => {
      this.focusTerminalInput();
    };
    const bind = (type: string, options?: AddEventListenerOptions): void => {
      this.viewportHost.addEventListener(type, focusTerminalInput, options);
      this.viewportInteractionDisposers.push(() => {
        this.viewportHost.removeEventListener(type, focusTerminalInput, options);
      });
    };

    bind("pointerdown", { passive: true });
    bind("mousedown", { passive: true });
    bind("touchstart", { passive: true });
    bind("click", { passive: true });
    bind("focusin");
    const handleWheel = (event: WheelEvent): void => {
      const deltaRows = Math.trunc(event.deltaY);
      if (!this.liveTransportEnabled || this.connectionState !== "connected" || deltaRows === 0) {
        return;
      }
      const sent = this.requestViewportDelta({ deltaRows });
      if (sent) {
        event.preventDefault();
      }
    };
    this.viewportHost.addEventListener("wheel", handleWheel, { passive: false });
    this.viewportInteractionDisposers.push(() => {
      this.viewportHost.removeEventListener("wheel", handleWheel);
    });
  }

  private clearRendererScrollSurfaceBindings(): void {
    for (const dispose of this.rendererScrollInteractionDisposers) {
      dispose();
    }
    this.rendererScrollInteractionDisposers = [];
    this.boundRendererScrollSurface = null;
  }

  private bindRendererScrollSurface(): void {
    if (!this.viewportHost) {
      this.clearRendererScrollSurfaceBindings();
      return;
    }
    const scrollSurface = this.viewportHost.querySelector<HTMLElement>(`[${TERMINAL_PUBLIC_SCROLL_ATTRIBUTE}]`);
    if (!scrollSurface) {
      this.clearRendererScrollSurfaceBindings();
      return;
    }
    if (this.boundRendererScrollSurface === scrollSurface && this.rendererScrollInteractionDisposers.length > 0) {
      return;
    }

    this.clearRendererScrollSurfaceBindings();
    const handleScroll = (): void => {
      if (!this.liveTransportEnabled || this.connectionState !== "connected") {
        return;
      }
      if (this.rendererScrollSyncSuppressed) {
        return;
      }
      const viewportStart = this.resolveViewportStartFromRendererScrollSurface(scrollSurface);
      if (viewportStart === null || viewportStart === this.lastAppliedViewportStart) {
        return;
      }
      this.requestViewportTarget({ viewportStart });
    };
    scrollSurface.addEventListener("scroll", handleScroll, { passive: true });
    this.rendererScrollInteractionDisposers.push(() => {
      scrollSurface.removeEventListener("scroll", handleScroll);
    });
    this.boundRendererScrollSurface = scrollSurface;
  }

  private resolveViewportStartFromRendererScrollSurface(scrollSurface: HTMLElement): number | null {
    const snapshot = this.snapshot;
    if (!snapshot) {
      return null;
    }
    const screenLines = Math.max(1, snapshot.scrollback.screenLines);
    const maxViewportStart = Math.max(0, snapshot.scrollback.totalLines - screenLines);
    if (maxViewportStart === 0) {
      return 0;
    }
    const maxScrollTop = scrollSurface.scrollHeight - scrollSurface.clientHeight;
    if (Number.isFinite(maxScrollTop) && maxScrollTop > 0) {
      const ratio = Math.max(0, Math.min(1, scrollSurface.scrollTop / maxScrollTop));
      return Math.max(0, Math.min(maxViewportStart, Math.round(ratio * maxViewportStart)));
    }
    const rowHeight =
      this.screenMetrics && snapshot.rows > 0 ? this.screenMetrics.height / Math.max(1, snapshot.rows) : 0;
    if (!Number.isFinite(rowHeight) || rowHeight <= 0) {
      return null;
    }
    return Math.max(0, Math.min(maxViewportStart, Math.round(scrollSurface.scrollTop / rowHeight)));
  }

  private applyAuthoritativeViewport(viewportStart: number): void {
    this.lastAppliedViewportStart = viewportStart;
    this.withSuppressedRendererScrollSync(() => {
      this.terminalSession?.applyViewport?.(viewportStart);
    });
  }

  private withSuppressedRendererScrollSync<T>(callback: () => T): T {
    this.rendererScrollSyncSuppressed = true;
    let result!: T;
    try {
      result = callback();
    } finally {
      const release = () => {
        this.rendererScrollSyncReleaseFrame = 0;
        this.rendererScrollSyncSuppressed = false;
      };
      if (typeof requestAnimationFrame === "function") {
        if (this.rendererScrollSyncReleaseFrame !== 0) {
          cancelAnimationFrame(this.rendererScrollSyncReleaseFrame);
        }
        this.rendererScrollSyncReleaseFrame = requestAnimationFrame(release);
      } else {
        setTimeout(release, 0);
      }
    }
    return result;
  }

  private focusTerminalInput(): void {
    const inputElement = this.terminalSession?.inputElement;
    if (!this.terminalSession || !inputElement) {
      return;
    }
    if (inputElement.ownerDocument.activeElement === inputElement) {
      this.pendingTerminalFocus = false;
      return;
    }
    this.terminalSession.focus();
    queueMicrotask(() => {
      const nextInputElement = this.terminalSession?.inputElement;
      if (!this.isConnected || !this.terminalSession || !nextInputElement) {
        return;
      }
      if (nextInputElement.ownerDocument.activeElement === nextInputElement) {
        this.pendingTerminalFocus = false;
        return;
      }
      this.terminalSession.focus();
      if (nextInputElement.ownerDocument.activeElement === nextInputElement) {
        this.pendingTerminalFocus = false;
      }
    });
  }

  private resizeTerminal(cols: number, rows: number): void {
    if (!this.terminalSession || cols < 1 || rows < 1) {
      return;
    }
    if (this.terminalSession.cols === cols && this.terminalSession.rows === rows) {
      return;
    }
    this.terminalSession.resize(cols, rows);
    this.syncMeasuredScreen();
    this.requestUpdate();
  }

  private hydrateSnapshot(
    snapshot: TerminalViewSnapshot | null,
    source: "prop" | "transport" | "renderer",
    options?: { force?: boolean },
  ): boolean {
    if (!snapshot || !this.terminalSession) {
      return false;
    }
    const geometryChanged = this.terminalSession.cols !== snapshot.cols || this.terminalSession.rows !== snapshot.rows;
    const force = options?.force === true;
    const viewportChanged = this.lastAppliedViewportStart !== snapshot.scrollback.viewportOffset;
    if (source === "prop" && this.connectionState === "connected" && this.liveSnapshotHydrated) {
      if (this.latestLiveFrame && this.snapshot !== this.latestLiveFrame) {
        this.snapshot = this.latestLiveFrame;
      }
      return false;
    }
    if (!force && snapshot.seq <= this.hydratedSnapshotSeq && !geometryChanged && !viewportChanged) {
      return false;
    }
    this.hydratedSnapshotSeq = Math.max(this.hydratedSnapshotSeq, snapshot.seq);
    this.terminalSession.setScrollback(resolveSnapshotScrollback(snapshot));
    this.replaceTextEvidence(snapshot.lines.join("\n"));
    if (force || geometryChanged) {
      this.resizeTerminal(snapshot.cols, snapshot.rows);
      this.terminalSession.reset();
      const rendered = serializeSnapshot(snapshot);
      if (rendered.length > 0) {
        this.terminalSession.write(rendered);
      }
    }
    this.applyAuthoritativeViewport(snapshot.scrollback.viewportOffset);
    void this.terminalSession.settlePresentation?.();
    this.syncMeasuredScreen();
    return force || geometryChanged || viewportChanged;
  }

  private applyLiveFrame(frame: TerminalTransportFramePayload): void {
    this.latestLiveFrame = frame;
    this.snapshot = frame;
    const geometryChanged =
      this.terminalSession === null ||
      this.terminalSession.cols !== frame.cols ||
      this.terminalSession.rows !== frame.rows;
    if (!this.liveSnapshotHydrated || geometryChanged) {
      this.liveSnapshotHydrated = this.hydrateSnapshot(frame, "transport") || this.liveSnapshotHydrated;
      return;
    }
    this.hydratedSnapshotSeq = Math.max(this.hydratedSnapshotSeq, frame.seq);
    this.replaceTextEvidence(frame.lines.join("\n"));
    this.applyAuthoritativeViewport(frame.scrollback.viewportOffset);
  }

  private resolvePullFrameDelayMs(): number {
    return this.dirtyFrameSeq > this.observedFrameSeq ? 50 : 1000;
  }

  private markFrameDirty(frameSeq: number): void {
    this.dirtyFrameSeq = Math.max(this.dirtyFrameSeq, frameSeq);
    this.schedulePullFrame();
  }

  private schedulePullFrame(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.connectionState !== "connected") {
      return;
    }
    if (this.pullFrameInFlight) {
      return;
    }
    if (this.pullFrameTimer) {
      return;
    }
    const delayMs = this.resolvePullFrameDelayMs();
    const elapsed = Date.now() - this.lastPullFrameAt;
    const waitMs = this.pullDueNow || this.dirtyFrameSeq > this.observedFrameSeq ? 0 : Math.max(0, delayMs - elapsed);
    this.pullFrameTimer = setTimeout(() => {
      this.pullFrameTimer = null;
      if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.connectionState !== "connected") {
        return;
      }
      if (this.pullFrameInFlight) {
        return;
      }
      this.pullFrameInFlight = true;
      this.pullDueNow = false;
      this.lastPullFrameAt = Date.now();
      const sent = this.sendClientMessage({
        type: "pullFrame",
        lastAppliedFrameSeq: this.snapshot?.seq ?? 0,
        cols: this.snapshot?.cols ?? this.terminalSession?.cols ?? DEFAULT_COLS,
        rows: this.snapshot?.rows ?? this.terminalSession?.rows ?? DEFAULT_ROWS,
      });
      if (!sent) {
        this.pullFrameInFlight = false;
      }
    }, waitMs);
  }

  private syncSocket(): void {
    this.disconnectSocket();
    if (this.rendererErrorMessage) {
      this.connectionState = "error";
      this.errorMessage = this.rendererErrorMessage;
      return;
    }
    if (!this.liveTransportEnabled || !this.transportUrl) {
      this.connectionState = "idle";
      this.errorMessage = "";
      return;
    }
    this.connectionState = "connecting";
    const socket = new WebSocket(this.transportUrl);
    socket.binaryType = "arraybuffer";
    this.socket = socket;
    socket.addEventListener("open", () => {
      if (this.socket !== socket) {
        return;
      }
      this.connectionState = "connected";
      this.errorMessage = "";
      this.liveSnapshotHydrated = false;
      this.dirtyFrameSeq = Math.max(this.dirtyFrameSeq, this.snapshot?.seq ?? 0);
      this.observedFrameSeq = Math.max(this.observedFrameSeq, this.snapshot?.seq ?? 0);
      this.pullDueNow = true;
      this.syncGeometryAuthorityHandshake();
      this.schedulePullFrame();
    });
    socket.addEventListener("message", (event) => {
      this.handleSocketMessage(event.data);
    });
    socket.addEventListener("close", () => {
      if (this.socket !== socket) {
        return;
      }
      this.socket = null;
      if (this.connectionState !== "error") {
        this.connectionState = "closed";
      }
    });
    socket.addEventListener("error", () => {
      if (this.socket !== socket) {
        return;
      }
      this.connectionState = "error";
      this.errorMessage = this.errorMessage || "transport error";
    });
  }

  private disconnectSocket(): void {
    if (!this.socket) {
      return;
    }
    this.socket.close();
    this.socket = null;
    this.rowCacheDecoder.reset();
    this.observedFrameSeq = this.snapshot?.seq ?? 0;
    this.pullDueNow = false;
    this.lastSentResize = null;
    this.pullFrameInFlight = false;
    if (this.pullFrameTimer) {
      clearTimeout(this.pullFrameTimer);
      this.pullFrameTimer = null;
    }
  }

  private syncGeometryAuthorityHandshake(): void {
    this.sendClientMessage({
      type: "hello",
      terminalId: this.terminalId || undefined,
      geometryRole: this.geometryRole,
      geometryOrder: this.geometryOrder,
    });
  }

  private sendClientMessage(message: TerminalTransportClientMessage): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN || this.connectionState !== "connected") {
      return false;
    }
    this.socket.send(toOwnedArrayBuffer(encodeTerminalTransportClientMessage(message)));
    return true;
  }

  private handleSocketMessage(raw: unknown): void {
    if (!(raw instanceof ArrayBuffer)) {
      this.connectionState = "error";
      this.errorMessage = "invalid transport payload";
      return;
    }
    const message = decodeTerminalTransportServerMessage(raw);
    if (!message) {
      this.connectionState = "error";
      this.errorMessage = "invalid transport payload";
      return;
    }
    if (message.type === "frameDirty") {
      this.markFrameDirty(message.frameSeq);
      return;
    }
    if (message.type === "frame") {
      this.observedFrameSeq = Math.max(this.observedFrameSeq, message.frameSeq);
      if (message.patch.type === "notModified") {
        this.pullFrameInFlight = false;
        this.schedulePullFrame();
        return;
      }
      const nextFrame = applyTerminalFramePatch(
        this.latestLiveFrame ?? this.snapshot,
        message.patch,
        message.frameSeq,
        this.rowCacheDecoder,
      );
      this.pullFrameInFlight = false;
      if (nextFrame) {
        this.applyLiveFrame(nextFrame);
      }
      this.schedulePullFrame();
      return;
    }
    if (message.type === "status") {
      if (!message.running) {
        this.connectionState = "closed";
      }
      return;
    }
    if (message.type === "helloAck") {
      this.transportAttachmentId = message.attachmentId;
      this.effectiveGeometryRole = message.effectiveGeometryRole;
      this.geometryAuthorityAttachmentId = message.geometryAuthorityAttachmentId ?? "";
      this.geometryAuthorityReason = message.authorityReason ?? "";
      const detail: TerminalViewGeometryAuthorityDetail = {
        terminalId: message.terminalId,
        requestedGeometryRole: this.geometryRole,
        effectiveGeometryRole: message.effectiveGeometryRole,
        geometryOrder: message.geometryOrder,
        transportAttachmentId: message.attachmentId,
        geometryAuthorityAttachmentId: message.geometryAuthorityAttachmentId,
        authorityReason: message.authorityReason,
      };
      this.dispatchEvent(
        new CustomEvent<TerminalViewGeometryAuthorityDetail>("terminal-view-geometry-authority", {
          bubbles: true,
          composed: true,
          detail,
        }),
      );
      return;
    }
    if (message.type === "error") {
      this.connectionState = "error";
      this.errorMessage = message.message;
    }
  }

  private syncMeasuredScreen(): void {
    const measured = this.terminalSession?.getScreenMetrics() ?? null;
    if (measured) {
      this.setScreenMetrics(measured.width, measured.height);
    }
  }

  private setScreenMetrics(width: number, height: number): void {
    const roundedWidth = Math.round(width);
    const roundedHeight = Math.round(height);
    if (roundedWidth === this.screenWidth && roundedHeight === this.screenHeight) {
      return;
    }
    this.screenWidth = roundedWidth;
    this.screenHeight = roundedHeight;
    this.screenMetrics = { width: roundedWidth, height: roundedHeight };
    this.dispatchEvent(
      new CustomEvent<TerminalViewScreenMetrics>("terminal-view-screen-metrics", {
        bubbles: true,
        composed: true,
        detail: this.screenMetrics,
      }),
    );
    this.requestUpdate();
  }

  private replaceTextEvidence(value: string): void {
    this.textEvidenceBuffer = this.clampTextEvidence(stripTerminalControlText(value));
    this.syncTextEvidenceNode();
  }

  private syncPermissionRequests(): void {
    const activeRequestIds = new Set(this.permissionRequests.map((request) => request.requestId));
    for (const requestId of [...this.permissionRequestHandlerFingerprints.keys()]) {
      if (!activeRequestIds.has(requestId)) {
        this.permissionRequestHandlerFingerprints.delete(requestId);
        this.customHandledPermissionRequestIds.delete(requestId);
      }
    }
    if (!this.onRequestPermissions) {
      this.permissionRequestHandlerFingerprints.clear();
      this.customHandledPermissionRequestIds.clear();
      this.requestUpdate();
      this.schedulePopoverSync();
      return;
    }
    for (const request of this.permissionRequests) {
      if (request.terminalId !== this.terminalId) {
        continue;
      }
      const fingerprint = this.permissionRequestFingerprint(request);
      if (this.permissionRequestHandlerFingerprints.get(request.requestId) === fingerprint) {
        continue;
      }
      this.permissionRequestHandlerFingerprints.set(request.requestId, fingerprint);
      const handled = this.onRequestPermissions({
        terminalId: this.terminalId,
        request,
      });
      if (handled === true) {
        this.customHandledPermissionRequestIds.add(request.requestId);
      } else {
        this.customHandledPermissionRequestIds.delete(request.requestId);
      }
    }
    this.requestUpdate();
    this.schedulePopoverSync();
  }

  private permissionRequestFingerprint(request: TerminalViewPermissionRequest): string {
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

  private resolveDefaultPermissionRequest(): TerminalViewPermissionRequest | null {
    const requests = this.permissionRequests.filter(
      (request) => request.terminalId === this.terminalId && !this.customHandledPermissionRequestIds.has(request.requestId),
    );
    return (
      requests.find((request) => request.status === "pending") ??
      requests.find((request) => request.status === "expired" || request.status === "denied") ??
      null
    );
  }

  private renderPermissionPopover(request: TerminalViewPermissionRequest) {
    const preview = request.requestedInput?.text ?? "(no input preview)";
    const expires = new Date(request.expiresAt).toLocaleTimeString();
    return html`
      <section
        popover="manual"
        class="terminal-permission-popover"
        data-terminal-permission-popover="true"
        data-terminal-permission-request-id=${request.requestId}
        data-terminal-permission-status=${request.status}
      >
        <p class="terminal-permission-title">Terminal write approval</p>
        <p class="terminal-permission-meta">${request.participantId} requests ${request.requestedInput?.mode ?? "input"} access</p>
        <pre class="terminal-permission-preview">${preview}</pre>
        ${request.status === "pending"
          ? html`
              <p class="terminal-permission-status">Pending until ${expires}</p>
              <div class="terminal-permission-actions">
                <button
                  type="button"
                  class="terminal-permission-button"
                  data-action="deny"
                  @click=${() => this.dispatchApprovalAction("deny", request)}
                >
                  Deny
                </button>
                <button
                  type="button"
                  class="terminal-permission-button"
                  data-action="approve"
                  @click=${() => this.dispatchApprovalAction("approve", request)}
                >
                  Approve
                </button>
              </div>
            `
          : html`<p class="terminal-permission-status">Request ${request.status}</p>`}
      </section>
    `;
  }

  private dispatchApprovalAction(action: TerminalViewApprovalActionDetail["action"], request: TerminalViewPermissionRequest): void {
    const detail: TerminalViewApprovalActionDetail = {
      terminalId: request.terminalId,
      requestId: request.requestId,
      action,
    };
    this.dispatchEvent(
      new CustomEvent<TerminalViewApprovalActionDetail>("terminal-view-approval-action", {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private schedulePopoverSync(): void {
    this.scheduleAfterUpdate(() => {
      this.syncPermissionPopover();
    });
  }

  private syncPermissionPopover(): void {
    const popover = this.permissionPopover;
    if (!popover || typeof popover.showPopover !== "function") {
      return;
    }
    if (!popover.matches(":popover-open")) {
      popover.showPopover();
    }
  }

  private clampTextEvidence(value: string): string {
    if (value.length <= MAX_TEXT_EVIDENCE_LENGTH) {
      return value;
    }
    return value.slice(-MAX_TEXT_EVIDENCE_LENGTH);
  }

  private ensureTextEvidenceNode(): HTMLSpanElement {
    const existing = this.querySelector<HTMLSpanElement>(`[${TERMINAL_TEXT_EVIDENCE_ATTRIBUTE}]`);
    if (existing) {
      this.textEvidenceNode = existing;
      this.syncTextEvidenceNode();
      return existing;
    }
    const node = this.ownerDocument.createElement("span");
    node.setAttribute(TERMINAL_TEXT_EVIDENCE_ATTRIBUTE, "true");
    node.setAttribute("aria-live", "polite");
    node.setAttribute("aria-atomic", "false");
    node.style.position = "absolute";
    node.style.width = "1px";
    node.style.height = "1px";
    node.style.padding = "0";
    node.style.margin = "-1px";
    node.style.overflow = "hidden";
    node.style.clip = "rect(0, 0, 0, 0)";
    node.style.clipPath = "inset(50%)";
    node.style.border = "0";
    node.style.whiteSpace = "pre";
    this.appendChild(node);
    this.textEvidenceNode = node;
    this.syncTextEvidenceNode();
    return node;
  }

  private syncTextEvidenceNode(): void {
    const node = this.textEvidenceNode ?? (this.isConnected ? this.ensureTextEvidenceNode() : null);
    if (!node) {
      return;
    }
    node.textContent = this.textEvidenceBuffer;
  }
}

export const defineTerminalView = (): void => {
  if (!customElements.get(TERMINAL_VIEW_TAG)) {
    customElements.define(TERMINAL_VIEW_TAG, TerminalViewElement);
  }
};

export type { TerminalTransportServerMessage, TerminalTransportServerMessage as TerminalViewTransportMessage };

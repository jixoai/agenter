import type {
  GlobalRoomMessage,
  GlobalTerminalEntry,
  RuntimeClientState,
} from "@agenter/client-sdk";
import type { TerminalRenderRichLine } from "@agenter/termless-core";
import {
  BoxRenderable,
  CliRenderEvents,
  type CliRenderer,
  type RenderContext,
  type KeyEvent,
  type MouseEvent,
} from "@opentui/core";

import type { CliShellManagedState } from "../managed";
import { measureTerminalText } from "./cell-width";
import { buildCliShellComposedSurface, toProductTerminalComposedSurface } from "./composed-surface";
import {
  routeCliShellKey,
  routeCliShellMouseScroll,
  routeCliShellPaste,
  routeCliShellPointerAction,
  routeCliShellViewportTarget,
  loadOlderCliShellDialogueMessages,
  submitCliShellDialogue,
  syncCliShellTerminalGeometry,
  type CliShellTuiControllerContext,
} from "./controller";
import { CliShellDebugBarRenderable } from "./debug-bar";
import {
  createCliShellDialogueViewportOwner,
  createCliShellDialogueRowsCache,
  type CliShellDialogueRowsCache,
  type CliShellDialogueViewportOwner,
} from "./dialogue-surface";
import type { CliShellDialogueScrollRow } from "./dialogue-scrollbox";
import {
  layoutCliShellTuiFrame,
  resolveCliShellTranscriptPanelLayout,
  resolveCliShellScrollbarPointerTarget,
  resolveCliShellShellScrollbarProjection,
  resolveCliShellTuiInteractionLayout,
} from "./frame";
import { CliShellDialogueBackend } from "./dialogue-backend";
import type { CliShellTuiKeybindings } from "./keybindings";
import {
  CLI_SHELL_PRODUCT_DYNAMIC_QUIET_MS,
  createCliShellLiveTerminalMirror,
  type CliShellLiveTerminalMirror,
  type CliShellLiveTerminalTransportSessionFactory,
  type CliShellLiveTerminalView,
} from "./live-terminal-mirror";
import { projectMarkdownLastLine } from "./markdown-projection";
import { buildCliShellDialogueBlocks, buildCliShellTuiModel } from "./model";
import {
  isPointInsideDialoguePanel,
  resolveComposedSurfaceCursorCellPosition,
  resolveVisibleCursorCellPosition,
  toNativeHardwareCursorPosition,
} from "./native-projection";
import {
  resolveComposedSurfaceKey,
  resolvePublishedComposedSurface,
  richLinesFromComposedSurface,
  resolveSnapshotRichLines,
  snapshotsShareVisibleBody,
} from "./app-projection";
import { isCliShellImagePastePayload, readCliShellPastePayload } from "./paste-input";
import { createCliShellPerfTracer, type CliShellPerfTracer } from "./perf-trace";
import type { CliShellProjectionFrameSource } from "./projection-law";
import { ShellTerminalViewRenderable } from "./shell-terminal-view";
import {
  CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
  type CliShellInteractionEnhancementProfile,
} from "./interaction-capabilities";
import type {
  CliShellComposedSurfaceState,
  CliShellObservationReadyBaseline,
  CliShellSelectionSource,
  CliShellSelectionSourceDescriptor,
  CliShellTerminalApprovalActionDetail,
  CliShellTuiModel,
  CliShellTuiStore,
  CliShellTuiViewState,
} from "./types";
import { createInitialCliShellViewState } from "./view-state";
import type {
  TerminalTransportInteractionFrameState,
  TerminalTransportOwnerCoordinate,
  TerminalTransportSelectionOverlay,
} from "@agenter/terminal-transport-protocol";

export interface CliShellCoreAppProps {
  renderer: CliRenderer;
  store: CliShellTuiStore;
  sessionId: string;
  shellName: string;
  fallbackTerminalId: string;
  roomChatId: string;
  roomAccessToken?: string;
  runtimeId: string;
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number];
  managed: CliShellManagedState;
  keybindings: CliShellTuiKeybindings;
  onQuit: () => void;
  observationReadyBaseline?: CliShellObservationReadyBaseline | null;
  debug?: boolean;
  debugFilters?: readonly string[];
  experimentalDynamicRefresh?: boolean;
  interactionProfile?: CliShellInteractionEnhancementProfile;
  createTransportSession?: CliShellLiveTerminalTransportSessionFactory;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readKeyEvent = (value: unknown): KeyEvent | null => {
  if (!isRecord(value)) {
    return null;
  }
  return value as unknown as KeyEvent;
};

const viewFromGlobalTerminalEntry = (entry: GlobalTerminalEntry | null): CliShellLiveTerminalView | null => {
  const snapshot = entry?.snapshot;
  if (!snapshot) {
    return null;
  }
  const rows = Math.max(1, Math.trunc(snapshot.scrollback.screenLines ?? snapshot.rows));
  const cols = Math.max(1, Math.trunc(snapshot.cols));
  const viewportStart = Math.max(0, Math.trunc(snapshot.scrollback.viewportOffset));
  const allRichLines = resolveSnapshotRichLines(snapshot);
  const canSliceViewport = snapshot.lines.length > rows && viewportStart + rows <= snapshot.lines.length;
  const richLines = canSliceViewport ? allRichLines : allRichLines.slice(0, rows);
  const plainLines = canSliceViewport ? [...snapshot.lines] : snapshot.lines.slice(0, rows);
  while (richLines.length < rows) {
    richLines.push({ spans: [] });
  }
  while (plainLines.length < rows) {
    plainLines.push("");
  }
  const rawCursorY = Math.max(0, Math.trunc(snapshot.cursor.y));
  const localCursorY = Math.max(0, Math.min(rows - 1, rawCursorY));
  const cursorAbsRow = canSliceViewport ? rawCursorY : viewportStart + localCursorY;
  const viewportEnd = viewportStart + rows;
  return {
    snapshotSeq: snapshot.seq,
    plainLines,
    richLines,
    cursorAbsRow,
    cursorCol: Math.max(0, Math.trunc(snapshot.cursor.x)),
    cursorVisible: snapshot.cursor.visible ?? true,
    rows,
    cols,
    viewportStart,
    viewportEnd,
    scrollbackRows: Math.max(snapshot.scrollback.totalLines, plainLines.length, viewportEnd),
    running: entry.processPhase !== "stopped",
    connected: false,
  };
};

const hydrateSelectionSourcesForVisibleLines = (input: {
  descriptors: readonly CliShellSelectionSourceDescriptor[] | undefined;
  fallback: readonly CliShellSelectionSource[];
  visibleLines: readonly TerminalRenderRichLine[];
}): readonly CliShellSelectionSource[] => {
  if (!input.descriptors || input.descriptors.length === 0) {
    return input.fallback;
  }
  return input.descriptors.map((descriptor) => {
    const fallback = input.fallback.find((source) => source.owner === descriptor.owner);
    const start = Math.max(0, Math.trunc(descriptor.row));
    const end = Math.max(start, start + Math.max(0, Math.trunc(descriptor.height)));
    return {
      ...descriptor,
      lines:
        fallback?.lines ??
        input.visibleLines.slice(start, end).map((line) => ({
          spans: line.spans.map((span) => ({ ...span })),
        })),
    };
  });
};

export class CliShellCoreApp {
  readonly #props: CliShellCoreAppProps;
  readonly #renderer: CliRenderer;
  readonly #perfTracer: CliShellPerfTracer;
  readonly #root: BoxRenderable;
  readonly #terminalView: ShellTerminalViewRenderable;
  readonly #dialogueViewportOwner: CliShellDialogueViewportOwner;
  readonly #dialogueRowsCache: CliShellDialogueRowsCache;
  readonly #dialogueBackend: CliShellDialogueBackend;
  readonly #debugBar: CliShellDebugBarRenderable | null;
  #viewState: CliShellTuiViewState;
  #state: RuntimeClientState;
  #toolbarHeartbeatProjection = "";
  #toolbarHeartbeatProjectionKey = "";
  #toolbarHeartbeatProjectionInFlightKey = "";
  #geometryKey = "";
  #localComposedInteractionDirty = false;
  #sourceMirror: CliShellLiveTerminalMirror | null = null;
  #sourceMirrorTransportUrl: string | null = null;
  #liveTerminalRenderPending = false;
  #liveTerminalRenderInFlight = false;
  #debugBarTimer: ReturnType<typeof setInterval> | null = null;
  #lastRenderTraceAt = 0;
  #renderNowDepth = 0;
  #renderNowCount = 0;
  #composedSurfaceKey = "";
  #localComposedSurface: CliShellComposedSurfaceState | null = null;
  #dialogueLoadBeforeInFlight = false;
  #releaseStore: (() => void) | null = null;
  #releaseRoom: (() => void) | null = null;
  #releaseTerminals: (() => void) | null = null;
  #releasePermissionRequests: (() => void) | null = null;
  #releaseSourceMirror: (() => void) | null = null;
  #disposed = false;
  #lastModel: CliShellTuiModel | null = null;

  constructor(props: CliShellCoreAppProps) {
    this.#props = props;
    this.#renderer = props.renderer;
    this.#perfTracer = createCliShellPerfTracer({ enabled: props.debug === true, filters: props.debugFilters });
    this.#dialogueRowsCache = createCliShellDialogueRowsCache();
    this.#dialogueViewportOwner = createCliShellDialogueViewportOwner(this.#renderer as RenderContext, {
      id: "cli-shell-dialogue-native-scrollbox",
      width: 1,
      height: 1,
      rows: [],
      initialScrollTop: 0,
    });
    this.#dialogueBackend = new CliShellDialogueBackend({
      viewportOwner: this.#dialogueViewportOwner,
      rowsCache: this.#dialogueRowsCache,
    });
    this.#viewState = createInitialCliShellViewState(props.managed);
    this.#state = props.store.getState();
    this.#renderer.setGatherStats?.(this.#perfTracer.enabled);

    this.#root = new BoxRenderable(this.#renderer, {
      id: "cli-shell-core-root",
      width: "100%",
      height: "100%",
      position: "absolute",
      top: 0,
      left: 0,
    });
    this.#debugBar =
      props.debug === true
        ? new CliShellDebugBarRenderable(this.#renderer, {
            id: "cli-shell-debug-bar",
            position: "absolute",
            top: 0,
            left: 0,
            width: Math.max(1, this.#renderer.width),
            height: 1,
            snapshot: this.#perfTracer.snapshot(),
          })
        : null;
    this.#terminalView = new ShellTerminalViewRenderable(this.#renderer, {
      id: "cli-shell-terminal-view",
      position: "absolute",
      top: this.#contentTop(),
      left: 0,
      width: Math.max(1, this.#renderer.width),
      height: Math.max(1, this.#contentHeight()),
      terminalId: props.fallbackTerminalId,
      focused: true,
      lines: [],
      onApprovalAction: (detail) => {
        this.#handleApprovalAction(detail);
      },
      onMouseDown: (event) => this.#handleShellMouseDown(event),
      onMouseDrag: (event) => this.#handleShellMouseDrag(event),
      onMouseScroll: (event) => this.#handleTerminalScroll(event),
      onSelectionStart: (point) => this.#routeSelectionStartForPoint(point),
      onSelectionUpdate: (point) => this.#routeSelectionUpdate(point),
      onSelectionEnd: (point) => this.#routeSelectionEnd(point),
      onSelectWordAt: (point) => this.#routeSelectWordAtForPoint(point),
      onSelectLineAt: (point) => this.#routeSelectLineAtForPoint(point),
      onClearSelection: (point) => this.#routeClearSelectionForPoint(point),
      onInteractionTrace: (event) => this.#perfTracer.record(event),
      interactionProfile: props.interactionProfile ?? CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
    });
    if (this.#debugBar) {
      this.#root.add(this.#debugBar);
    }
    this.#root.add(this.#terminalView);
    this.#renderer.root.add(this.#root);
    this.#terminalView.focus();
  }

  start(): void {
    if (this.#disposed) {
      return;
    }
    this.#releaseStore = this.#props.store.subscribe(() => {
      this.#state = this.#props.store.getState();
      this.renderNow("store-update");
    });
    this.#releaseRoom = this.#props.store.retainGlobalRoomSnapshot(this.#props.roomChatId);
    void this.#props.store
      .hydrateGlobalRoomSnapshot({
        chatId: this.#props.roomChatId,
        accessToken: this.#props.roomAccessToken,
        force: true,
      })
      .catch(() => undefined);
    this.#releaseTerminals = this.#props.store.retainGlobalTerminals();
    if (this.#props.fallbackTerminalId.trim().length > 0) {
      this.#releasePermissionRequests = this.#props.store.retainTerminalPermissionRequests({
        terminalId: this.#props.fallbackTerminalId,
      });
      void this.#props.store
        .hydrateGlobalTerminals({ force: true })
        .then(async (terminals) => {
          const terminal = terminals.find((entry) => entry.terminalId === this.#props.fallbackTerminalId);
          if (terminal?.snapshot?.lines?.some((line) => line.length > 0)) {
            return;
          }
          await this.#props.store.readGlobalTerminal({
            terminalId: this.#props.fallbackTerminalId,
            mode: "snapshot",
            recordActivity: false,
          });
        })
        .catch(() => undefined);
    }
    this.#renderer.keyInput.on("keypress", this.#handleKeypress);
    this.#renderer.keyInput.on("paste", this.#handlePaste);
    this.#renderer.on(CliRenderEvents.RESIZE, this.#handleResize);
    if (this.#debugBar) {
      this.#debugBarTimer = setInterval(() => {
        this.#debugBar!.snapshot = this.#perfTracer.snapshot();
      }, 500);
    }
    this.renderNow("start");
    this.#renderer.requestRender();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    if (this.#debugBarTimer) {
      clearInterval(this.#debugBarTimer);
      this.#debugBarTimer = null;
    }
    this.#releaseStore?.();
    this.#releaseStore = null;
    this.#releaseRoom?.();
    this.#releaseRoom = null;
    this.#releaseTerminals?.();
    this.#releaseTerminals = null;
    this.#releasePermissionRequests?.();
    this.#releasePermissionRequests = null;
    this.#releaseSourceMirror?.();
    this.#releaseSourceMirror = null;
    this.#sourceMirror?.disconnect();
    this.#sourceMirror = null;
    this.#renderer.keyInput.off("keypress", this.#handleKeypress);
    this.#renderer.keyInput.off("paste", this.#handlePaste);
    this.#renderer.off(CliRenderEvents.RESIZE, this.#handleResize);
    this.#perfTracer.dispose();
    this.#root.destroyRecursively();
  }

  renderNow(reason = "manual"): void {
    if (this.#disposed) {
      return;
    }
    const renderStartedAt = performance.now();
    this.#renderNowDepth += 1;
    this.#renderNowCount += 1;
    const renderSeq = this.#renderNowCount;
    if (this.#perfTracer.enabled) {
      this.#perfTracer.record({
        kind: "render-now-started",
        detail: {
          reason,
          renderSeq,
          depth: this.#renderNowDepth,
          rendererWidth: this.#renderer.width,
          rendererHeight: this.#renderer.height,
        },
      });
    }
    const width = Math.max(1, this.#renderer.width);
    const contentHeight = this.#contentHeight();
    const contentTop = this.#contentTop();
    this.#root.width = width;
    this.#root.height = Math.max(1, this.#renderer.height);
    if (this.#debugBar) {
      this.#debugBar.width = width;
      this.#debugBar.height = 1;
      this.#debugBar.snapshot = this.#perfTracer.snapshot();
    }

    const state = this.#state;
    const roomSnapshot = state.globalRoomSnapshotsById[this.#props.roomChatId]?.data ?? null;
    const activeTerminalId = this.#props.fallbackTerminalId;
    const terminalEntry =
      state.globalTerminals.data.find((entry) => entry.terminalId === activeTerminalId) ?? null;
    const shellSourceTerminalId =
      typeof terminalEntry?.metadata?.composedShellTerminalId === "string"
        ? terminalEntry.metadata.composedShellTerminalId
        : null;
    const shellSourceEntry =
      shellSourceTerminalId
        ? state.globalTerminals.data.find((entry) => entry.terminalId === shellSourceTerminalId) ?? null
        : null;
    const sourceMirrorEntry = shellSourceEntry ?? (!shellSourceTerminalId ? terminalEntry : null);
    this.#syncSourceMirror({ shellSourceEntry: sourceMirrorEntry });

    const sourceTerminal = this.#sourceMirror?.getView() ?? viewFromGlobalTerminalEntry(sourceMirrorEntry);
    const shellSnapshotSeqFallback = shellSourceEntry?.snapshot?.seq ?? -1;
    const publishedSurfaceState = resolvePublishedComposedSurface({
      terminalEntry,
      shellSnapshotSeqFallback,
    });
    const hasPublishedComposedTruth =
      publishedSurfaceState.hasPublishedTruth ||
      !snapshotsShareVisibleBody(terminalEntry?.snapshot, shellSourceEntry?.snapshot);

    const model = buildCliShellTuiModel({
      state,
      projection: {
        roomSnapshot,
        liveTerminal: sourceTerminal,
      },
      sessionId: this.#props.sessionId,
      shellName: this.#props.shellName,
      fallbackTerminalId: this.#props.fallbackTerminalId,
      avatarActorId: this.#props.avatarActorId,
      ui: this.#viewState,
      keybindings: this.#props.keybindings,
      width,
      height: contentHeight,
      toolbarHeartbeatProjection: this.#toolbarHeartbeatProjection,
      observationReadyBaseline: this.#props.observationReadyBaseline,
      interactionProfile: this.#props.interactionProfile ?? CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
    });
    this.#lastModel = model;
    this.#syncDialogueViewStateFromModel(model);
    this.#syncActiveFocus();
    this.#projectToolbarHeartbeat({ model, width });
    const interactionLayout = resolveCliShellTuiInteractionLayout({ model, width, height: contentHeight });
    if (interactionLayout.terminalScrollRegion) {
      this.#sourceMirror?.setPullGeometry(
        interactionLayout.terminalScrollRegion.width,
        interactionLayout.terminalScrollRegion.height,
      );
    }
    const frame = layoutCliShellTuiFrame({
      model,
      width,
      height: contentHeight,
      renderToolbar: false,
      dialogueViewportOwner: this.#dialogueViewportOwner,
      dialogueRowsCache: this.#dialogueRowsCache,
    });
    const visibleSnapshotLines = resolveSnapshotRichLines(terminalEntry?.snapshot);
    const visibleSnapshotMatchesFrame =
      !!terminalEntry?.snapshot &&
      terminalEntry.snapshot.cols === width &&
      terminalEntry.snapshot.rows === contentHeight &&
      visibleSnapshotLines.length >= contentHeight;
    const sourceTerminalIsNewerThanPublished =
      !!sourceTerminal &&
      sourceTerminal.snapshotSeq > (publishedSurfaceState.surface?.shellSnapshotSeq ?? shellSnapshotSeqFallback);
    const shouldBuildLocalTerminal2Surface =
      !!shellSourceTerminalId &&
      (this.#localComposedInteractionDirty ||
        sourceTerminalIsNewerThanPublished ||
        this.#viewState.activeFocusTarget === "dialogue" ||
        !publishedSurfaceState.surface ||
        (visibleSnapshotLines.length > 0 && !visibleSnapshotMatchesFrame));
    const surfaceFrame = shouldBuildLocalTerminal2Surface
      ? layoutCliShellTuiFrame({
          model,
          width,
          height: contentHeight,
          renderToolbar: true,
          dialogueViewportOwner: this.#dialogueViewportOwner,
          dialogueRowsCache: this.#dialogueRowsCache,
        })
      : null;
    const localComposedSurface = shouldBuildLocalTerminal2Surface
      ? buildCliShellComposedSurface({
          shellTerminalId: shellSourceTerminalId!,
          terminalId: model.terminalId,
          model,
          width,
          height: contentHeight,
          dialogueViewportOwner: this.#dialogueViewportOwner,
          dialogueRowsCache: this.#dialogueRowsCache,
          frame: surfaceFrame ?? undefined,
          cursor: surfaceFrame?.cursor,
        })
      : null;
    this.#syncDialogueBackend({ model, width, height: contentHeight });
    if (localComposedSurface) {
      this.#publishComposedSurface({
        model,
        surface: localComposedSurface,
      });
    }
    const visibleProjection = (() => {
      if (localComposedSurface) {
        const lines = richLinesFromComposedSurface(localComposedSurface);
        return {
          source: "terminal-2-local-frame" as const,
          lines,
          selectionSources: hydrateSelectionSourcesForVisibleLines({
            descriptors: localComposedSurface.selectionSources,
            fallback: frame.selectionSources,
            visibleLines: lines,
          }),
          cursor: localComposedSurface.cursor,
        };
      }
      if (shellSourceTerminalId && visibleSnapshotLines.length > 0 && terminalEntry?.snapshot) {
        return {
          source: "visible-snapshot" as const,
          lines: visibleSnapshotLines,
          selectionSources: hydrateSelectionSourcesForVisibleLines({
            descriptors: publishedSurfaceState.surface?.selectionSources,
            fallback: frame.selectionSources,
            visibleLines: visibleSnapshotLines,
          }),
          cursor: resolveComposedSurfaceCursorCellPosition({
            x: terminalEntry.snapshot.cursor.x,
            y: terminalEntry.snapshot.cursor.y,
            visible: terminalEntry.snapshot.cursor.visible ?? true,
            lineCount: visibleSnapshotLines.length,
          }),
        };
      }
      return {
        source: "terminal-2-bootstrap-frame" as const,
        lines: frame.styledLines,
        selectionSources: frame.selectionSources,
        cursor: frame.cursor ?? resolveVisibleCursorCellPosition({ model, width, height: contentHeight }),
      };
    })();

    this.#terminalView.top = contentTop;
    this.#terminalView.left = 0;
    this.#terminalView.width = width;
    this.#terminalView.height = contentHeight;
    const terminalPermissionRequests = state.globalTerminalApprovalsById[activeTerminalId]?.data ?? [];
    const terminalPaintStats = this.#terminalView.updateProjection({
      terminalId: activeTerminalId,
      lines: visibleProjection.lines,
      permissionRequests: terminalPermissionRequests,
      onApprovalAction: (detail) => {
        this.#handleApprovalAction(detail);
      },
      selectionRegion: interactionLayout.terminalScrollRegion
      ? {
          x: interactionLayout.terminalScrollRegion.col,
          y: interactionLayout.terminalScrollRegion.row,
          width: interactionLayout.terminalScrollRegion.width,
          height: interactionLayout.terminalScrollRegion.height,
        }
      : null,
      selectionRegions: interactionLayout.selectionRegions,
      selectionSources: visibleProjection.selectionSources,
      selectionOverlays: this.#resolveSelectionOverlays(model.terminalView.interaction),
      interactionProfile: model.interactionProfile ?? CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
    });

    this.#syncGeometry({ model, width, height: contentHeight, shellSourceTerminalId });
    this.#syncCursor({
      model,
      width,
      height: contentHeight,
      contentTop,
      cursor: visibleProjection.cursor,
    });
    this.#traceRender({
      model,
      width,
      height: contentHeight,
      projectionSource: visibleProjection.source,
      visibleLineCount: visibleProjection.lines.length,
      visibleSpanCount: visibleProjection.lines.reduce((total, line) => total + line.spans.length, 0),
      terminalPaintStats,
    });
    this.#terminalView.focus();
    if (this.#perfTracer.enabled) {
      this.#perfTracer.record({
        kind: "render-now-finished",
        detail: {
          reason,
          renderSeq,
          depth: this.#renderNowDepth,
          durationMs: Number((performance.now() - renderStartedAt).toFixed(2)),
          width,
          height: contentHeight,
          projectionSource: visibleProjection.source,
        },
      });
    }
    this.#renderNowDepth -= 1;
  }

  #contentTop(): number {
    return this.#props.debug === true ? 1 : 0;
  }

  #contentHeight(): number {
    return Math.max(1, this.#renderer.height - this.#contentTop());
  }

  #controllerContext(): CliShellTuiControllerContext {
    return {
      store: this.#props.store,
      sessionId: this.#props.sessionId,
      shellName: this.#props.shellName,
      roomChatId: this.#props.roomChatId,
      roomAccessToken: this.#props.roomAccessToken,
      runtimeId: this.#props.runtimeId,
      avatarActorId: this.#props.avatarActorId,
      keybindings: this.#props.keybindings,
      onQuit: this.#props.onQuit,
      trackAsyncTask: (task: Promise<void>) => {
        void task.catch(() => undefined);
      },
      getViewState: () => this.#viewState,
      getModel: () => this.#lastModel ?? this.#fallbackModel(),
      getLiveMirror: () => this.#sourceMirror,
      getDialogueScrollRows: () => this.#resolveDialogueScrollRows(),
      resolveDialogueScrollRows: (window) => this.#resolveDialogueScrollRowsForWindow(window),
      trace: this.#perfTracer,
      updateViewState: (updater) => {
        this.#localComposedInteractionDirty = true;
        const next = updater(this.#viewState);
        this.#viewState = next;
        this.renderNow("view-state-update");
      },
    };
  }

  #syncDialogueViewStateFromModel(model: CliShellTuiModel): void {
    const currentWindow = this.#viewState.dialogueWindow;
    if (
      currentWindow &&
      currentWindow.messageIds.join(",") === model.dialogueWindow.messageIds.join(",") &&
      currentWindow.nextBefore === model.dialogueWindow.nextBefore &&
      currentWindow.hasMoreBefore === model.dialogueWindow.hasMoreBefore &&
      currentWindow.loadingBefore === model.dialogueWindow.loadingBefore &&
      currentWindow.pinnedToBottom === model.dialogueWindow.pinnedToBottom &&
      currentWindow.pendingNewMessageCount === model.dialogueWindow.pendingNewMessageCount &&
      currentWindow.error === model.dialogueWindow.error
    ) {
      return;
    }
    this.#viewState = {
      ...this.#viewState,
      dialogueWindow: model.dialogueWindow,
    };
  }

  #fallbackModel(): CliShellTuiModel {
    return buildCliShellTuiModel({
      state: this.#state,
      projection: {
        roomSnapshot: this.#state.globalRoomSnapshotsById[this.#props.roomChatId]?.data ?? null,
        liveTerminal: this.#sourceMirror?.getView() ?? null,
      },
      sessionId: this.#props.sessionId,
      shellName: this.#props.shellName,
      fallbackTerminalId: this.#props.fallbackTerminalId,
      avatarActorId: this.#props.avatarActorId,
      ui: this.#viewState,
      keybindings: this.#props.keybindings,
      width: Math.max(1, this.#renderer.width),
      height: this.#contentHeight(),
      toolbarHeartbeatProjection: this.#toolbarHeartbeatProjection,
      observationReadyBaseline: this.#props.observationReadyBaseline,
      interactionProfile: this.#props.interactionProfile ?? CLI_SHELL_DEFAULT_INTERACTION_PROFILE,
    });
  }

  #resolveDialogueScrollRows(model: CliShellTuiModel | null = this.#lastModel): CliShellDialogueScrollRow[] {
    if (!model || !model.dialoguePlacement) {
      return [];
    }
    const layout = resolveCliShellTranscriptPanelLayout({
      model,
      width: Math.max(1, this.#renderer.width),
      height: this.#contentHeight(),
    });
    const contentWidth = Math.max(1, layout.width - 4);
    return this.#dialogueRowsCache.getRows({
      model,
      width: contentWidth,
    });
  }

  #resolveDialogueScrollRowsForWindow(input: {
    messages: CliShellTuiModel["dialogueWindow"]["messages"];
    messageIds: CliShellTuiModel["dialogueWindow"]["messageIds"];
  }): CliShellDialogueScrollRow[] {
    const baseModel = this.#lastModel ?? this.#fallbackModel();
    return this.#resolveDialogueScrollRows({
      ...baseModel,
      dialogueBlocks: buildCliShellDialogueBlocks({
        messages: input.messages,
        avatarActorId: this.#props.avatarActorId,
      }),
    });
  }

  #appendDialogueDraft(text: string): void {
    if (text.length === 0) {
      return;
    }
    this.#controllerContext().updateViewState((current) => ({
      ...current,
      dialogueDraft: `${current.dialogueDraft}${text}`,
      statusNotice: null,
    }));
  }

  #handleDialogueKey(key: KeyEvent): boolean {
    if (key.name === "return" || key.name === "linefeed") {
      const task = submitCliShellDialogue(this.#controllerContext());
      void task;
      key.preventDefault();
      return true;
    }
    if (!key.ctrl && !key.meta && !key.super && !key.hyper) {
      if (key.name === "backspace") {
        this.#controllerContext().updateViewState((current) => ({
          ...current,
          dialogueDraft: current.dialogueDraft.slice(0, -1),
          statusNotice: null,
        }));
        key.preventDefault();
        return true;
      }
      if (key.name === "space") {
        this.#appendDialogueDraft(" ");
        key.preventDefault();
        return true;
      }
      if (key.sequence) {
        const firstCharCode = key.sequence.charCodeAt(0);
        if (firstCharCode >= 32 && firstCharCode !== 127) {
          this.#appendDialogueDraft(key.sequence);
          key.preventDefault();
          return true;
        }
      }
    }
    return false;
  }

  #handleKeypress = (value: unknown): void => {
    const key = readKeyEvent(value);
    if (!key) {
      return;
    }
    this.#perfTracer.record({
      kind: "key-event",
      detail: {
        keyName: key.name,
        sequenceLength: key.sequence?.length ?? 0,
        rawLength: key.raw?.length ?? 0,
        sequence: key.sequence,
        raw: key.raw,
        ctrl: key.ctrl === true,
        shift: key.shift === true,
        meta: key.meta === true,
        option: key.option === true,
        optionLike:
          key.option === true ||
          key.meta === true ||
          key.sequence === "\u001bb" ||
          key.raw === "\u001bb" ||
          key.sequence === "\u001bf" ||
          key.raw === "\u001bf",
        wordNavigationSequence:
          key.sequence === "\u001bb" || key.raw === "\u001bb"
            ? "left"
            : key.sequence === "\u001bf" || key.raw === "\u001bf"
              ? "right"
              : null,
        super: key.super === true,
        hyper: key.hyper === true,
        source: key.source,
        code: key.code ?? null,
        focusTarget: this.#viewState.focusTarget,
        activeFocusTarget: this.#viewState.activeFocusTarget,
      },
    });
    if (((key.meta || key.super) && key.name === "c") || (key.ctrl && key.shift && key.name === "c")) {
      if (this.#copyActiveSelection()) {
        key.preventDefault();
      }
      return;
    }
    if (this.#viewState.focusTarget === "dialogue" && this.#handleDialogueKey(key)) {
      return;
    }
    if (routeCliShellKey(this.#controllerContext(), key)) {
      key.preventDefault();
    }
  };

  #handlePaste = (value: unknown): void => {
    const payload = readCliShellPastePayload(value);
    if (payload.kind === "unsupported") {
      return;
    }
    if (payload.kind === "media") {
      this.#perfTracer.record({
        kind: "paste-media-unsupported",
        detail: {
          itemCount: payload.items.length,
          image: isCliShellImagePastePayload(payload),
          mimeTypes: payload.items.map((item) => item.mimeType).join(","),
          focusTarget: this.#viewState.focusTarget,
          activeFocusTarget: this.#viewState.activeFocusTarget,
        },
      });
      return;
    }
    const text = payload.text;
    if (text.length === 0) {
      return;
    }
    this.#perfTracer.record({
      kind: "paste-event",
      detail: {
        byteLength: new TextEncoder().encode(text).byteLength,
        textLength: text.length,
        focusTarget: this.#viewState.focusTarget,
        activeFocusTarget: this.#viewState.activeFocusTarget,
      },
    });
    if (this.#viewState.activeFocusTarget === "dialogue") {
      this.#appendDialogueDraft(text.replace(/[\n\r]/g, ""));
      return;
    }
    routeCliShellPaste(this.#controllerContext(), text);
  };

  #handleResize = (): void => {
    this.renderNow("resize");
  };

  #copyActiveSelection(): boolean {
    const owner = this.#terminalView.getSelectionOwner() ?? this.#viewState.activeFocusTarget ?? "terminal";
    if (owner === "dialogue") {
      const text = this.#dialogueBackend.copySelection();
      const sent = text.length > 0 && this.#renderer.copyToClipboardOSC52(text);
      this.#perfTracer.record({
        kind: "selection-copy-requested",
        detail: {
          ownerId: "dialogue",
          sent,
          textLength: text.length,
        },
      });
      return sent;
    }
    const sent = this.#sourceMirror?.copySelection("terminal") ?? false;
    this.#perfTracer.record({
      kind: "selection-copy-requested",
      detail: {
        ownerId: "terminal",
        sent,
      },
    });
    return sent;
  }

  #copySelectionTextFromBackend(event: { ownerId?: string; text: string }): void {
    if (event.text.length === 0) {
      this.#perfTracer.record({
        kind: "selection-copy-empty",
        detail: { ownerId: event.ownerId ?? "terminal" },
      });
      return;
    }
    const copied = this.#renderer.copyToClipboardOSC52(event.text);
    this.#perfTracer.record({
      kind: "selection-copy-delivered",
      detail: {
        ownerId: event.ownerId ?? "terminal",
        textLength: event.text.length,
        copied,
      },
    });
  }

  #syncDialogueBackend(input: { model: CliShellTuiModel; width: number; height: number }): void {
    const layout = resolveCliShellTranscriptPanelLayout(input);
    this.#dialogueBackend.project({
      layout,
      model: input.model,
    });
  }

  #resolveSelectionOverlays(
    shellInteraction: TerminalTransportInteractionFrameState | undefined,
  ): TerminalTransportSelectionOverlay[] {
    return [
      ...(shellInteraction?.selectionOverlays ?? []),
      ...(this.#dialogueBackend.getInteractionFrameState().selectionOverlays ?? []),
    ].map((overlay) => ({
      ownerId: overlay.ownerId,
      ownership: overlay.ownership,
      rows: overlay.rows.map((row) => ({ ...row })),
      selectedText: overlay.selectedText,
    }));
  }

  #routeSelectionStart(point: TerminalTransportOwnerCoordinate): boolean {
    this.#perfTracer.record({
      kind: "selection-start-routed",
      detail: { ownerId: point.ownerId, row: point.row, col: point.col },
    });
    if (point.ownerId === "dialogue") {
      return this.#dialogueBackend.selectionStart(point);
    }
    return this.#sourceMirror?.selectionStart(point) ?? false;
  }

  #routeSelectionUpdate(point: TerminalTransportOwnerCoordinate): boolean {
    this.#perfTracer.record({
      kind: "selection-update-routed",
      detail: { ownerId: point.ownerId, row: point.row, col: point.col },
    });
    if (point.ownerId === "dialogue") {
      return this.#dialogueBackend.selectionUpdate(point);
    }
    return this.#sourceMirror?.selectionUpdate(point) ?? false;
  }

  #routeSelectionEnd(point: TerminalTransportOwnerCoordinate): boolean {
    this.#perfTracer.record({
      kind: "selection-end-routed",
      detail: { ownerId: point.ownerId, row: point.row, col: point.col },
    });
    if (point.ownerId === "dialogue") {
      const ended = this.#dialogueBackend.selectionEnd(point);
      this.renderNow("dialogue-selection-end");
      return ended;
    }
    return this.#sourceMirror?.selectionEnd(point) ?? false;
  }

  #routeSelectWordAt(point: TerminalTransportOwnerCoordinate): boolean {
    this.#perfTracer.record({
      kind: "semantic-selection-word-routed",
      detail: { ownerId: point.ownerId, row: point.row, col: point.col },
    });
    if (point.ownerId === "dialogue") {
      const selected = this.#dialogueBackend.selectWordAt(point);
      this.renderNow("dialogue-select-word");
      return selected;
    }
    return this.#sourceMirror?.selectWordAt(point) ?? false;
  }

  #routeSelectLineAt(point: TerminalTransportOwnerCoordinate): boolean {
    this.#perfTracer.record({
      kind: "semantic-selection-line-routed",
      detail: { ownerId: point.ownerId, row: point.row, col: point.col },
    });
    if (point.ownerId === "dialogue") {
      const selected = this.#dialogueBackend.selectLineAt(point);
      this.renderNow("dialogue-select-line");
      return selected;
    }
    return this.#sourceMirror?.selectLineAt(point) ?? false;
  }

  #clearSelectionForOwner(ownerId: "terminal" | "dialogue"): boolean {
    if (ownerId === "dialogue") {
      const cleared = this.#dialogueBackend.clearSelection();
      this.renderNow("dialogue-selection-clear");
      return cleared;
    }
    return this.#sourceMirror?.clearSelection("terminal") ?? false;
  }

  #clearOtherSelection(ownerId: "terminal" | "dialogue"): void {
    const other = ownerId === "terminal" ? "dialogue" : "terminal";
    this.#clearSelectionForOwner(other);
  }

  #activateSelectionOwner(ownerId: "terminal" | "dialogue"): void {
    this.#clearOtherSelection(ownerId);
  }

  #isKnownSelectionOwner(ownerId: string): ownerId is "terminal" | "dialogue" {
    return ownerId === "terminal" || ownerId === "dialogue";
  }

  #normalizeSelectionOwner(point: TerminalTransportOwnerCoordinate): "terminal" | "dialogue" | null {
    return this.#isKnownSelectionOwner(point.ownerId) ? point.ownerId : null;
  }

  #routeSelectionStartForPoint(point: TerminalTransportOwnerCoordinate): boolean {
    const owner = this.#normalizeSelectionOwner(point);
    if (!owner) {
      return false;
    }
    this.#activateSelectionOwner(owner);
    return this.#routeSelectionStart(point);
  }

  #routeSelectWordAtForPoint(point: TerminalTransportOwnerCoordinate): boolean {
    const owner = this.#normalizeSelectionOwner(point);
    if (!owner) {
      return false;
    }
    this.#activateSelectionOwner(owner);
    return this.#routeSelectWordAt(point);
  }

  #routeSelectLineAtForPoint(point: TerminalTransportOwnerCoordinate): boolean {
    const owner = this.#normalizeSelectionOwner(point);
    if (!owner) {
      return false;
    }
    this.#activateSelectionOwner(owner);
    return this.#routeSelectLineAt(point);
  }

  #routeClearSelectionForPoint(point: TerminalTransportOwnerCoordinate): boolean {
    const owner = this.#normalizeSelectionOwner(point);
    if (!owner) {
      return false;
    }
    this.#perfTracer.record({
      kind: "selection-clear-routed",
      detail: { ownerId: owner, row: point.row, col: point.col },
    });
    return this.#clearSelectionForOwner(owner);
  }

  #handleTerminalScroll(event: MouseEvent): void {
    const direction = event.scroll?.direction;
    const delta = event.scroll?.delta ?? 1;
    if (!direction) {
      return;
    }
    const signedDelta = direction === "up" ? -delta : direction === "down" ? delta : 0;
    if (signedDelta === 0) {
      return;
    }
    const model = this.#lastModel ?? this.#fallbackModel();
    const x = Math.max(0, Math.trunc(event.x ?? 0));
    const y = Math.max(0, Math.trunc(event.y ?? 0)) - this.#contentTop();
    if (
      y >= 0 &&
      isPointInsideDialoguePanel({
        model,
        width: Math.max(1, this.#renderer.width),
        height: this.#contentHeight(),
        x,
        y,
      })
    ) {
      this.#routeDialogueScroll({
        model,
        width: Math.max(1, this.#renderer.width),
        height: this.#contentHeight(),
        deltaRows: signedDelta,
      });
      event.preventDefault();
      return;
    }
    this.#perfTracer.record({
      kind: "viewport-delta",
      detail: {
        source: "wheel",
        deltaRows: signedDelta,
        viewportStart: model.terminalView.viewportStart,
        scrollbackRows: model.terminalView.scrollbackRows,
        screenRows: model.terminalView.rows,
      },
    });
    const sent = routeCliShellMouseScroll(this.#controllerContext(), { deltaRows: signedDelta });
    this.#perfTracer.record({
      kind: "viewport-delta-routed",
      detail: {
        source: "wheel",
        deltaRows: signedDelta,
        sent,
      },
    });
  }

  #routeDialogueScroll(input: {
    model: CliShellTuiModel;
    width: number;
    height: number;
    deltaRows: number;
  }): void {
    const layout = resolveCliShellTranscriptPanelLayout({
      model: input.model,
      width: input.width,
      height: input.height,
    });
    const frame = this.#dialogueBackend.project({
      layout,
      model: input.model,
    });
    const scrollSnapshot = this.#dialogueViewportOwner.sync({
      width: Math.max(1, layout.width - 4),
      height: Math.max(1, frame.viewport.visibleRows),
      rows: this.#resolveDialogueScrollRows(input.model),
      scrollTop: frame.viewport.scrollTop + Math.trunc(input.deltaRows),
    });
    const nextScrollTop = scrollSnapshot.scrollTop;
    const pinnedToBottom = scrollSnapshot.pinnedToBottom;
    this.#controllerContext().updateViewState((current) => ({
      ...current,
      dialogueOpen: true,
      focusTarget: "dialogue",
      dialogueScrollTop: nextScrollTop,
      dialogueWindow: current.dialogueWindow
        ? {
            ...current.dialogueWindow,
            pinnedToBottom,
            pendingNewMessageCount: pinnedToBottom ? 0 : current.dialogueWindow.pendingNewMessageCount,
            anchor: pinnedToBottom ? null : current.dialogueWindow.anchor,
          }
        : current.dialogueWindow,
      statusNotice: null,
    }));
    if (scrollSnapshot.nearTop && input.model.dialogueWindow.hasMoreBefore && !this.#dialogueLoadBeforeInFlight) {
      this.#dialogueLoadBeforeInFlight = true;
      const task = loadOlderCliShellDialogueMessages(this.#controllerContext()).finally(() => {
        this.#dialogueLoadBeforeInFlight = false;
      });
      void task;
    }
    this.#perfTracer.record({
      kind: "viewport-delta",
      detail: {
        source: "dialogue-wheel",
        deltaRows: input.deltaRows,
        viewportStart: nextScrollTop,
      },
    });
  }

  #handleShellMouseDown(event: MouseEvent): void {
    const x = Math.max(0, Math.trunc(event.x ?? 0));
    const y = Math.max(0, Math.trunc(event.y ?? 0)) - this.#contentTop();
    if (y < 0) {
      return;
    }
    const model = this.#lastModel ?? this.#fallbackModel();
    const width = Math.max(1, this.#renderer.width);
    const contentHeight = this.#contentHeight();
    const actionFrame = layoutCliShellTuiFrame({
      model,
      width,
      height: contentHeight,
      renderToolbar: true,
      dialogueViewportOwner: this.#dialogueViewportOwner,
      dialogueRowsCache: this.#dialogueRowsCache,
    });
    const hit = actionFrame.actionRegions.find(
      (region) =>
        y >= region.row &&
        y < region.row + region.height &&
        x >= region.col &&
        x < region.col + region.width,
    );
    if (hit) {
      routeCliShellPointerAction(this.#controllerContext(), hit.action);
      return;
    }
    if (this.#routeShellScrollbarPointer({ model, width, height: contentHeight, x, y, source: "scrollbar" })) {
      event.preventDefault();
      return;
    }
    if (isPointInsideDialoguePanel({ model, width, height: contentHeight, x, y })) {
      routeCliShellPointerAction(this.#controllerContext(), "focusDialogueInput");
      return;
    }
    this.#controllerContext().updateViewState((current) => ({
      ...current,
      focusTarget: "terminal",
    }));
  }

  #handleShellMouseDrag(event: MouseEvent): void {
    const x = Math.max(0, Math.trunc(event.x ?? 0));
    const y = Math.max(0, Math.trunc(event.y ?? 0)) - this.#contentTop();
    if (y < 0) {
      return;
    }
    const model = this.#lastModel ?? this.#fallbackModel();
    if (
      this.#routeShellScrollbarPointer({
        model,
        width: Math.max(1, this.#renderer.width),
        height: this.#contentHeight(),
        x,
        y,
        source: "scrollbar-drag",
      })
    ) {
      event.preventDefault();
    }
  }

  #handleApprovalAction(detail: CliShellTerminalApprovalActionDetail): void {
    const task =
      detail.action === "approve"
        ? this.#props.store.approveGlobalTerminalRequest({
            terminalId: detail.terminalId,
            requestId: detail.requestId,
            durationMs: detail.durationMs ?? 30 * 60 * 1000,
          })
        : this.#props.store.denyGlobalTerminalRequest({
            terminalId: detail.terminalId,
            requestId: detail.requestId,
          });
    void task
      .then(() => {
        this.#viewState = {
          ...this.#viewState,
          statusNotice: detail.action === "approve" ? "终端授权已批准" : "终端授权已拒绝",
        };
        this.renderNow("terminal-permission-decision");
      })
      .catch((error) => {
        this.#viewState = {
          ...this.#viewState,
          statusNotice: `终端授权处理失败: ${error instanceof Error ? error.message : String(error)}`,
        };
        this.renderNow("terminal-permission-decision-error");
      });
  }

  #bumpLiveTerminalRevision(trigger = "manual"): void {
    if (this.#liveTerminalRenderInFlight) {
      this.#liveTerminalRenderPending = true;
      this.#perfTracer.record({
        kind: "render-revision-coalesced",
        detail: {
          trigger,
          inFlight: true,
          pending: this.#liveTerminalRenderPending,
        },
      });
      return;
    }
    this.#runLiveTerminalRenderCycle(trigger);
  }

  #runLiveTerminalRenderCycle(trigger = "manual"): void {
    if (this.#disposed || this.#liveTerminalRenderInFlight) {
      return;
    }
    this.#liveTerminalRenderInFlight = true;
    this.#liveTerminalRenderPending = false;
    const revisionStartedAt = performance.now();
    this.#perfTracer.record({
      kind: "render-revision-scheduled",
      detail: {
        trigger,
        pending: this.#liveTerminalRenderPending,
      },
    });
    this.renderNow("live-terminal-revision");
    this.#perfTracer.record({
      kind: "render-requested",
      detail: {
        renderNowMs: Number((performance.now() - revisionStartedAt).toFixed(2)),
      },
    });
    this.#renderer.requestRender();
    const idleStartedAt = performance.now();
    void this.#renderer.idle().then(() => {
      this.#liveTerminalRenderInFlight = false;
      this.#perfTracer.record({
        kind: "render-revision-committed",
        detail: {
          trigger,
          idleWaitMs: Number((performance.now() - idleStartedAt).toFixed(2)),
          totalRevisionMs: Number((performance.now() - revisionStartedAt).toFixed(2)),
          pendingAfterIdle: this.#liveTerminalRenderPending,
        },
      });
      this.#sourceMirror?.notifyPaintCommitted();
      if (this.#liveTerminalRenderPending) {
        this.#runLiveTerminalRenderCycle("pending-after-idle");
      }
    }).catch(() => {
      this.#liveTerminalRenderInFlight = false;
      this.#perfTracer.record({ kind: "render-revision-failed", detail: { trigger } });
    });
  }

  #syncSourceMirror(input: {
    shellSourceEntry: GlobalTerminalEntry | null;
  }): void {
    // Mirror lifecycle is reconciled during renderNow. Scheduling another render here creates
    // a self-feeding paint loop when a product terminal has no live transport yet.
    if (!input.shellSourceEntry?.transportUrl) {
      this.#releaseSourceMirror?.();
      this.#releaseSourceMirror = null;
      this.#sourceMirror?.disconnect();
      this.#sourceMirror = null;
      this.#sourceMirrorTransportUrl = null;
    } else if (this.#sourceMirrorTransportUrl !== input.shellSourceEntry.transportUrl) {
      this.#releaseSourceMirror?.();
      this.#releaseSourceMirror = null;
      this.#sourceMirror?.disconnect();
      const mirror = createCliShellLiveTerminalMirror({
        terminalId: input.shellSourceEntry.terminalId,
        transportUrl: input.shellSourceEntry.transportUrl,
        initialSnapshot: input.shellSourceEntry.snapshot ?? null,
        geometryRole: "authority",
        debugTrace: this.#props.debug === true && (this.#props.debugFilters?.length ?? 0) === 0,
        pacing: {
          mode: this.#props.experimentalDynamicRefresh === false ? "fixed" : "dynamic",
          dynamicQuietMs: CLI_SHELL_PRODUCT_DYNAMIC_QUIET_MS,
        },
        trace: this.#perfTracer,
        requestPaint: () => this.#bumpLiveTerminalRevision("source-mirror.requestPaint"),
        onSelectionText: (event) => this.#copySelectionTextFromBackend(event),
        createTransportSession: this.#props.createTransportSession,
      });
      this.#sourceMirror = mirror;
      this.#sourceMirrorTransportUrl = input.shellSourceEntry.transportUrl;
      this.#releaseSourceMirror = mirror.subscribe(() => {
        if (!mirror.getView().running) {
          this.#props.onQuit();
        }
      });
      void mirror.connect().catch(() => undefined);
    }
    if (input.shellSourceEntry?.processPhase === "stopped") {
      this.#props.onQuit();
    }
  }

  #syncActiveFocus(): void {
    if (this.#viewState.activeFocusTarget === this.#viewState.focusTarget) {
      return;
    }
    this.#viewState = {
      ...this.#viewState,
      activeFocusTarget: this.#viewState.focusTarget,
    };
  }

  #projectToolbarHeartbeat(input: { model: CliShellTuiModel; width: number }): void {
    const separator = " │ ";
    const reserved =
      measureTerminalText(input.model.toolbarLeft) +
      measureTerminalText(input.model.toolbarManaged) +
      measureTerminalText(input.model.toolbarUnread) +
      measureTerminalText(separator) * 3;
    const projectionWidth = reserved >= input.width ? input.width : Math.max(1, input.width - reserved);
    const projectionKey = JSON.stringify({
      content: input.model.toolbarHeartbeat,
      width: projectionWidth,
    });
    if (!this.#toolbarHeartbeatProjection) {
      this.#toolbarHeartbeatProjection = input.model.toolbarHeartbeat;
    }
    if (
      projectionKey === this.#toolbarHeartbeatProjectionKey ||
      projectionKey === this.#toolbarHeartbeatProjectionInFlightKey
    ) {
      return;
    }
    this.#toolbarHeartbeatProjectionInFlightKey = projectionKey;
    void projectMarkdownLastLine({
      content: input.model.toolbarHeartbeat,
      width: projectionWidth,
    }).then((projection) => {
      if (this.#toolbarHeartbeatProjectionInFlightKey === projectionKey) {
        this.#toolbarHeartbeatProjectionInFlightKey = "";
      }
      if (this.#disposed) {
        return;
      }
      this.#toolbarHeartbeatProjectionKey = projectionKey;
      if (this.#toolbarHeartbeatProjection === projection) {
        return;
      }
      this.#toolbarHeartbeatProjection = projection;
      this.renderNow("toolbar-heartbeat-projection");
    }).catch(() => {
      if (this.#toolbarHeartbeatProjectionInFlightKey === projectionKey) {
        this.#toolbarHeartbeatProjectionInFlightKey = "";
      }
    });
  }

  #publishComposedSurface(input: { model: CliShellTuiModel; surface: CliShellComposedSurfaceState }): void {
    const surface = input.surface;
    const nextKey = resolveComposedSurfaceKey(surface);
    if (nextKey === this.#composedSurfaceKey) {
      return;
    }
    this.#composedSurfaceKey = nextKey;
    this.#localComposedSurface = surface;
    void this.#props.store
      .publishGlobalTerminalComposedSurface({
        terminalId: input.model.terminalId,
        surface: toProductTerminalComposedSurface(surface),
      })
      .then(() => {
        this.#localComposedInteractionDirty = false;
        if (this.#localComposedSurface === surface) {
          this.#localComposedSurface = null;
        }
      })
      .catch(() => undefined);
  }

  #routeShellScrollbarPointer(input: {
    model: CliShellTuiModel;
    width: number;
    height: number;
    x: number;
    y: number;
    source: "scrollbar" | "scrollbar-drag";
  }): boolean {
    const projection = resolveCliShellShellScrollbarProjection(input);
    if (!projection) {
      return false;
    }
    const region = projection.region;
    if (
      input.x < region.col ||
      input.x >= region.col + region.width ||
      input.y < region.row ||
      input.y >= region.row + region.height
    ) {
      return false;
    }
    const targetPosition = resolveCliShellScrollbarPointerTarget({
      projection,
      row: input.y,
    });
    this.#perfTracer.record({
      kind: "viewport-target",
      detail: {
        source: input.source,
        targetPosition,
        backendPosition: projection.state.scrollPosition,
        scrollSize: projection.state.scrollSize,
        viewportSize: projection.state.viewportSize,
      },
    });
    const sent = routeCliShellViewportTarget(this.#controllerContext(), { viewportStart: targetPosition });
    this.#perfTracer.record({
      kind: "viewport-target-routed",
      detail: {
        source: input.source,
        targetPosition,
        sent,
      },
    });
    return true;
  }

  #syncGeometry(input: {
    model: CliShellTuiModel;
    width: number;
    height: number;
    shellSourceTerminalId: string | null;
  }): void {
    void syncCliShellTerminalGeometry({
      store: this.#props.store,
      width: input.width,
      height: input.height,
      model: input.model,
      terminalId: input.shellSourceTerminalId ?? input.model.terminalId,
      previousGeometryKey: this.#geometryKey,
      liveMirror: this.#sourceMirror,
    })
      .then((nextKey) => {
        this.#geometryKey = nextKey;
      })
      .catch(() => undefined);
  }

  #syncCursor(input: {
    model: CliShellTuiModel;
    width: number;
    height: number;
    contentTop: number;
    cursor: { x: number; y: number; visible?: boolean } | null;
  }): void {
    const cursor =
      input.cursor ??
      resolveVisibleCursorCellPosition({
        model: input.model,
        width: input.width,
        height: input.height,
      });
    const hardwareCursor = toNativeHardwareCursorPosition({
      x: cursor.x,
      y: cursor.y + input.contentTop,
      visible: cursor.visible ?? true,
    });
    this.#perfTracer.record({
      kind: "cursor-synced",
      detail: {
        sourceX: cursor.x,
        sourceY: cursor.y,
        sourceVisible: cursor.visible ?? true,
        hardwareX: hardwareCursor.x,
        hardwareY: hardwareCursor.y,
        hardwareVisible: hardwareCursor.visible,
        contentTop: input.contentTop,
        focusTarget: input.model.focusTarget,
        activeFocusTarget: input.model.activeFocusTarget,
        viewportStart: input.model.terminalView.viewportStart,
        cursorAbsRow: input.model.terminalView.cursorAbsRow,
        cursorCol: input.model.terminalView.cursorCol,
      },
    });
    this.#renderer.setCursorPosition(
      Math.max(0, Math.trunc(hardwareCursor.x)),
      Math.max(0, Math.trunc(hardwareCursor.y)),
      hardwareCursor.visible,
    );
  }

  #traceRender(input: {
    model: CliShellTuiModel;
    width: number;
    height: number;
    projectionSource: string;
    visibleLineCount: number;
    visibleSpanCount: number;
    terminalPaintStats: ReturnType<ShellTerminalViewRenderable["updateProjection"]>;
  }): void {
    if (!this.#perfTracer.enabled) {
      return;
    }
    const now = Date.now();
    const elapsedMs = this.#lastRenderTraceAt === 0 ? 0 : now - this.#lastRenderTraceAt;
    this.#lastRenderTraceAt = now;
    const frameSource = resolveCliShellProjectionFrameSource(input.projectionSource);
    this.#perfTracer.record({
      kind: "render-applied",
      detail: {
        elapsedMs,
        estimatedFps: elapsedMs > 0 ? Number((1000 / elapsedMs).toFixed(2)) : null,
        stats: this.#renderer.getStats?.(),
        terminalPaintMs: Number(input.terminalPaintStats.durationMs.toFixed(2)),
        terminalPaintRows: input.terminalPaintStats.rows,
        terminalPaintSpans: input.terminalPaintStats.spans,
        terminalPaintGlyphs: input.terminalPaintStats.glyphs,
        width: input.width,
        height: input.height,
        snapshotSeq: input.model.terminalView.snapshotSeq,
        projectionSource: input.projectionSource,
        frameSource,
        visibleLineCount: input.visibleLineCount,
        visibleSpanCount: input.visibleSpanCount,
        viewportStart: input.model.terminalView.viewportStart,
        scrollbackRows: input.model.terminalView.scrollbackRows,
      },
    });
  }
}

const resolveCliShellProjectionFrameSource = (projectionSource: string): CliShellProjectionFrameSource => {
  if (projectionSource === "visible-snapshot") {
    return "terminal-2-composed";
  }
  if (projectionSource === "terminal-2-local-frame" || projectionSource === "terminal-2-bootstrap-frame") {
    return "terminal-2-composed";
  }
  if (projectionSource === "host-frame") {
    return "native-host-adapter";
  }
  return "terminal-1-shell";
};

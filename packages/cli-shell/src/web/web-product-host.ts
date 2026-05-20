import type { GlobalRoomMessage, GlobalTerminalEntry, RuntimeClientState } from "@agenter/client-sdk";
import type { CliShellBootstrapResult } from "../bootstrap";
import type { CliShellManagedState } from "../managed";
import { resolvePublishedComposedSurface, snapshotsShareVisibleBody } from "../tui/app-projection";
import { buildCliShellComposedSurface, toProductTerminalComposedSurface } from "../tui/composed-surface";
import {
  routeCliShellMouseScroll,
  routeCliShellPaste,
  routeCliShellPointerAction,
  routeCliShellViewportTarget,
  setCliShellDialogueDraft,
  submitCliShellDialogue,
  syncCliShellTerminalGeometry,
  type CliShellTuiControllerContext,
} from "../tui/controller";
import { projectCliShellDialogueBackendFrame } from "../tui/dialogue-backend";
import {
  resolveCliShellScrollbarPointerTarget,
  resolveCliShellShellScrollbarProjection,
  resolveCliShellTranscriptPanelLayout,
} from "../tui/frame";
import { resolveCliShellInteractionEnhancementProfile } from "../tui/interaction-capabilities";
import type { CliShellTuiKeybindings } from "../tui/keybindings";
import {
  createCliShellLiveTerminalMirror,
  type CliShellLiveTerminalMirror,
  type CliShellLiveTerminalTransportSessionFactory,
} from "../tui/live-terminal-mirror";
import { buildCliShellTuiModel } from "../tui/model";
import { createCliShellPerfTracer, type CliShellPerfTracer } from "../tui/perf-trace";
import type {
  CliShellComposedSurfaceState,
  CliShellObservationReadyBaseline,
  CliShellTuiModel,
  CliShellTuiStore,
  CliShellTuiViewState,
} from "../tui/types";
import { createInitialCliShellViewState } from "../tui/view-state";

export type CliShellWebProductHostAction =
  | { type: "open-dialogue" }
  | { type: "close-dialogue" }
  | { type: "focus-terminal" }
  | { type: "focus-dialogue" }
  | { type: "set-dialogue-draft"; draft: string }
  | { type: "append-dialogue-draft"; text: string }
  | { type: "submit-dialogue" }
  | { type: "paste"; text: string }
  | { type: "shell-scroll-delta"; deltaRows: number }
  | { type: "shell-scroll-target"; viewportStart: number }
  | { type: "shell-scrollbar-target"; row: number }
  | { type: "dialogue-scroll-delta"; deltaRows: number }
  | { type: "resize"; cols: number; rows: number };

export interface CliShellWebProductHostSnapshot {
  surface: CliShellComposedSurfaceState | null;
  model: CliShellTuiModel | null;
  textEvidence: string;
}

export interface CliShellWebProductHost {
  start(): void;
  dispose(): void;
  renderNow(): void;
  getSnapshot(): CliShellWebProductHostSnapshot;
  dispatch(action: CliShellWebProductHostAction): Promise<{ ok: true }>;
}

export interface CliShellWebProductHostInput {
  store: CliShellTuiStore;
  shellName: string;
  attached: CliShellBootstrapResult;
  keybindings: CliShellTuiKeybindings;
  observationReadyBaseline?: CliShellObservationReadyBaseline | null;
  debug?: boolean;
  debugFilters?: readonly string[];
  experimentalDynamicRefresh?: boolean;
  initialCols?: number;
  initialRows?: number;
  createTransportSession?: CliShellLiveTerminalTransportSessionFactory;
}

const LIVE_TERMINAL_RENDER_INTERVAL_MS = 33;

const resolveShellSourceTerminalId = (terminalEntry: GlobalTerminalEntry | null): string | null =>
  typeof terminalEntry?.metadata?.composedShellTerminalId === "string"
    ? terminalEntry.metadata.composedShellTerminalId
    : null;

const normalizeDimension = (value: number | undefined, fallback: number): number => {
  const normalized = Math.trunc(value ?? fallback);
  return Number.isFinite(normalized) ? Math.max(1, normalized) : fallback;
};

const createControllerContext = (input: {
  store: CliShellTuiStore;
  sessionId: string;
  shellName: string;
  roomChatId: string;
  roomAccessToken?: string;
  runtimeId: string;
  avatarActorId: GlobalRoomMessage["unreadActorIds"][number];
  keybindings: CliShellTuiKeybindings;
  trace?: CliShellPerfTracer;
  getViewState: () => CliShellTuiViewState;
  getModel: () => CliShellTuiModel;
  getLiveMirror: () => CliShellLiveTerminalMirror | null;
  updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => void;
}): CliShellTuiControllerContext => ({
  store: input.store,
  sessionId: input.sessionId,
  shellName: input.shellName,
  roomChatId: input.roomChatId,
  roomAccessToken: input.roomAccessToken,
  runtimeId: input.runtimeId,
  avatarActorId: input.avatarActorId,
  keybindings: input.keybindings,
  trace: input.trace,
  onQuit: () => undefined,
  trackAsyncTask: (task) => {
    void task.catch(() => undefined);
  },
  getViewState: input.getViewState,
  getModel: input.getModel,
  getLiveMirror: input.getLiveMirror,
  updateViewState: input.updateViewState,
});

export const startCliShellWebProductHost = (input: CliShellWebProductHostInput): CliShellWebProductHost => {
  let state: RuntimeClientState = input.store.getState();
  let width = normalizeDimension(input.initialCols, input.attached.visibleTerminal.entry.snapshot?.cols ?? 80);
  let height = normalizeDimension(input.initialRows, input.attached.visibleTerminal.entry.snapshot?.rows ?? 24);
  let viewState: CliShellTuiViewState = createInitialCliShellViewState(input.attached.managed as CliShellManagedState);
  let lastModel: CliShellTuiModel | null = null;
  let lastSurface: CliShellComposedSurfaceState | null = null;
  let lastSurfaceKey = "";
  let localComposedInteractionDirty = false;
  let sourceMirror: CliShellLiveTerminalMirror | null = null;
  let sourceMirrorTransportUrl: string | null = null;
  let visibleMirror: CliShellLiveTerminalMirror | null = null;
  let visibleMirrorTransportUrl: string | null = null;
  let geometryKey = "";
  let releaseStore: (() => void) | null = null;
  let releaseRoom: (() => void) | null = null;
  let releaseTerminals: (() => void) | null = null;
  let releaseSourceMirror: (() => void) | null = null;
  let releaseVisibleMirror: (() => void) | null = null;
  let liveTerminalRevisionTimer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const interactionProfile = resolveCliShellInteractionEnhancementProfile(
    input.attached.shellTruthTerminal.entry.backend,
  );
  const perfTracer = createCliShellPerfTracer({ enabled: input.debug === true, filters: input.debugFilters });

  const surfaceKey = (surface: CliShellComposedSurfaceState): string =>
    JSON.stringify({
      shellTerminalId: surface.shellTerminalId,
      terminalId: surface.terminalId,
      shellSnapshotSeq: surface.shellSnapshotSeq,
      cols: surface.cols,
      rows: surface.rows,
      dialogueOpen: surface.dialogueOpen,
      dialoguePlacement: surface.dialoguePlacement,
      dialogueDraft: surface.dialogueDraft,
      bottomLine: surface.bottomLine,
      cursor: surface.cursor,
      scrollback: surface.scrollback,
      selectionSources: surface.selectionSources,
      lines: surface.terminalLines,
      richLines: surface.terminalRichLines,
    });

  const bumpLiveRevision = (trigger = "manual"): void => {
    if (liveTerminalRevisionTimer) {
      perfTracer.record({
        kind: "render-revision-coalesced",
        detail: { host: "web-product-host", trigger, inFlight: true },
      });
      return;
    }
    perfTracer.record({
      kind: "render-revision-scheduled",
      detail: { delayMs: LIVE_TERMINAL_RENDER_INTERVAL_MS, host: "web-product-host", trigger },
    });
    liveTerminalRevisionTimer = setTimeout(() => {
      liveTerminalRevisionTimer = null;
      perfTracer.record({ kind: "render-revision-committed", detail: { host: "web-product-host", trigger } });
      host.renderNow();
    }, LIVE_TERMINAL_RENDER_INTERVAL_MS);
  };

  const syncMirror = (inputMirror: {
    current: CliShellLiveTerminalMirror | null;
    currentTransportUrl: string | null;
    terminalEntry: GlobalTerminalEntry | null;
    geometryRole: "projection-only" | "authority";
    release: (() => void) | null;
    assign(mirror: CliShellLiveTerminalMirror | null, transportUrl: string | null, release: (() => void) | null): void;
  }): void => {
    if (!inputMirror.terminalEntry?.transportUrl) {
      inputMirror.release?.();
      inputMirror.current?.disconnect();
      inputMirror.assign(null, null, null);
      bumpLiveRevision(`${inputMirror.geometryRole}.mirror-missing-transport`);
      return;
    }
    if (inputMirror.currentTransportUrl === inputMirror.terminalEntry.transportUrl) {
      return;
    }
    inputMirror.release?.();
    inputMirror.current?.disconnect();
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: inputMirror.terminalEntry.terminalId,
      transportUrl: inputMirror.terminalEntry.transportUrl,
      initialSnapshot: inputMirror.terminalEntry.snapshot ?? null,
      geometryRole: inputMirror.geometryRole,
      debugTrace: input.debug === true,
      pacing: {
        mode: input.experimentalDynamicRefresh === true ? "dynamic" : "fixed",
      },
      trace: perfTracer,
      createTransportSession: input.createTransportSession,
    });
    const release = mirror.subscribe(() => bumpLiveRevision(`${inputMirror.geometryRole}.mirror-subscribe`));
    inputMirror.assign(mirror, inputMirror.terminalEntry.transportUrl, release);
    void mirror.connect().catch(() => undefined);
    bumpLiveRevision(`${inputMirror.geometryRole}.mirror-connected`);
  };

  const buildModel = (): {
    model: CliShellTuiModel;
    terminalEntry: GlobalTerminalEntry | null;
    shellSourceEntry: GlobalTerminalEntry | null;
    shellSourceTerminalId: string | null;
  } => {
    const terminalEntry =
      state.globalTerminals.data.find(
        (entry) => entry.terminalId === input.attached.visibleTerminal.entry.terminalId,
      ) ?? null;
    const shellSourceTerminalId = resolveShellSourceTerminalId(terminalEntry);
    const shellSourceEntry = shellSourceTerminalId
      ? (state.globalTerminals.data.find((entry) => entry.terminalId === shellSourceTerminalId) ?? null)
      : null;
    syncMirror({
      current: sourceMirror,
      currentTransportUrl: sourceMirrorTransportUrl,
      terminalEntry: shellSourceEntry,
      geometryRole: "authority",
      release: releaseSourceMirror,
      assign(mirror, transportUrl, release) {
        sourceMirror = mirror;
        sourceMirrorTransportUrl = transportUrl;
        releaseSourceMirror = release;
      },
    });
    syncMirror({
      current: visibleMirror,
      currentTransportUrl: visibleMirrorTransportUrl,
      terminalEntry,
      geometryRole: "projection-only",
      release: releaseVisibleMirror,
      assign(mirror, transportUrl, release) {
        visibleMirror = mirror;
        visibleMirrorTransportUrl = transportUrl;
        releaseVisibleMirror = release;
      },
    });
    const model = buildCliShellTuiModel({
      state,
      projection: {
        roomSnapshot: state.globalRoomSnapshotsById[input.attached.room.entry.chatId]?.data ?? null,
        liveTerminal: sourceMirror?.getView() ?? null,
      },
      sessionId: input.attached.session.id,
      shellName: input.shellName,
      fallbackTerminalId: input.attached.visibleTerminal.entry.terminalId,
      avatarActorId: input.attached.avatarActorId,
      ui: viewState,
      keybindings: input.keybindings,
      width,
      height,
      observationReadyBaseline: input.observationReadyBaseline ?? null,
      interactionProfile,
    });
    return {
      model,
      terminalEntry,
      shellSourceEntry,
      shellSourceTerminalId,
    };
  };

  const publishSurface = (context: {
    model: CliShellTuiModel;
    terminalEntry: GlobalTerminalEntry | null;
    shellSourceEntry: GlobalTerminalEntry | null;
    shellSourceTerminalId: string | null;
  }): void => {
    if (!context.shellSourceTerminalId) {
      return;
    }
    const shellSnapshotSeqFallback = context.shellSourceEntry?.snapshot?.seq ?? -1;
    const published = resolvePublishedComposedSurface({
      terminalEntry: context.terminalEntry,
      shellSnapshotSeqFallback,
    });
    const hasPublishedComposedTruth =
      published.hasPublishedTruth ||
      !snapshotsShareVisibleBody(context.terminalEntry?.snapshot, context.shellSourceEntry?.snapshot);
    const publishedGeometryMatches = published.surface?.cols === width && published.surface.rows === height;
    if (
      hasPublishedComposedTruth &&
      publishedGeometryMatches &&
      !sourceMirror?.getView().connected &&
      !localComposedInteractionDirty &&
      context.model.terminalView.snapshotSeq <= (published.surface?.shellSnapshotSeq ?? -1)
    ) {
      lastSurface = published.surface;
      return;
    }
    const surface = buildCliShellComposedSurface({
      shellTerminalId: context.shellSourceTerminalId,
      terminalId: context.model.terminalId,
      model: context.model,
      width,
      height,
    });
    const nextKey = surfaceKey(surface);
    lastSurface = surface;
    if (nextKey === lastSurfaceKey) {
      return;
    }
    lastSurfaceKey = nextKey;
    void input.store
      .publishGlobalTerminalComposedSurface({
        terminalId: context.model.terminalId,
        surface: toProductTerminalComposedSurface(surface),
      })
      .then(() => {
        localComposedInteractionDirty = false;
      })
      .catch(() => undefined);
  };

  const getControllerContext = (): CliShellTuiControllerContext =>
    createControllerContext({
      store: input.store,
      sessionId: input.attached.session.id,
      shellName: input.shellName,
      roomChatId: input.attached.room.entry.chatId,
      roomAccessToken: input.attached.room.entry.accessToken,
      runtimeId: input.attached.avatar.runtimeId,
      avatarActorId: input.attached.avatarActorId,
      keybindings: input.keybindings,
      trace: perfTracer,
      getViewState: () => viewState,
      getModel: () => lastModel ?? buildModel().model,
      getLiveMirror: () => sourceMirror,
      updateViewState: (updater) => {
        localComposedInteractionDirty = true;
        viewState = updater(viewState);
        host.renderNow();
      },
    });

  const routeDialogueScroll = (deltaRows: number): void => {
    const delta = Math.trunc(deltaRows);
    if (!Number.isFinite(delta) || delta === 0) {
      return;
    }
    const model = lastModel ?? buildModel().model;
    const frame = projectCliShellDialogueBackendFrame({
      layout: resolveCliShellTranscriptPanelLayout({ model, width, height }),
      model,
    });
    viewState = {
      ...viewState,
      dialogueOpen: true,
      focusTarget: "dialogue",
      dialogueScrollOffset: Math.max(
        0,
        Math.min(frame.viewport.maxOffsetFromBottom, Math.trunc(viewState.dialogueScrollOffset ?? 0) + delta),
      ),
      statusNotice: null,
    };
    localComposedInteractionDirty = true;
    host.renderNow();
  };

  const host: CliShellWebProductHost = {
    start(): void {
      if (disposed) {
        return;
      }
      releaseStore = input.store.subscribe(() => {
        state = input.store.getState();
        host.renderNow();
      });
      releaseRoom = input.store.retainGlobalRoomSnapshot(input.attached.room.entry.chatId);
      void input.store
        .hydrateGlobalRoomSnapshot({
          chatId: input.attached.room.entry.chatId,
          accessToken: input.attached.room.entry.accessToken,
          force: true,
        })
        .catch(() => undefined);
      releaseTerminals = input.store.retainGlobalTerminals();
      void input.store.hydrateGlobalTerminals({ force: true }).catch(() => undefined);
      host.renderNow();
    },
    dispose(): void {
      if (disposed) {
        return;
      }
      disposed = true;
      if (liveTerminalRevisionTimer) {
        clearTimeout(liveTerminalRevisionTimer);
        liveTerminalRevisionTimer = null;
      }
      releaseStore?.();
      releaseRoom?.();
      releaseTerminals?.();
      releaseSourceMirror?.();
      releaseVisibleMirror?.();
      sourceMirror?.disconnect();
      visibleMirror?.disconnect();
      perfTracer.dispose();
      releaseStore = null;
      releaseRoom = null;
      releaseTerminals = null;
      releaseSourceMirror = null;
      releaseVisibleMirror = null;
      sourceMirror = null;
      visibleMirror = null;
    },
    renderNow(): void {
      if (disposed) {
        return;
      }
      const renderStartedAt = Date.now();
      const context = buildModel();
      lastModel = context.model;
      sourceMirror?.setPullGeometry(context.model.terminalView.cols, context.model.terminalView.rows);
      visibleMirror?.setPullGeometry(width, height);
      if (context.shellSourceEntry) {
        void syncCliShellTerminalGeometry({
          store: input.store,
          width,
          height,
          model: context.model,
          terminalId: context.shellSourceTerminalId ?? context.model.terminalId,
          previousGeometryKey: geometryKey,
          liveMirror: sourceMirror,
        }).then((nextGeometryKey) => {
          geometryKey = nextGeometryKey;
        });
      }
      publishSurface(context);
      perfTracer.record({
        kind: "render-applied",
        detail: {
          host: "web-product-host",
          elapsedMs: Date.now() - renderStartedAt,
          estimatedFps: null,
          terminalPaintMs: Date.now() - renderStartedAt,
          terminalPaintRows: height,
          terminalPaintSpans:
            lastSurface?.terminalRichLines?.reduce((total, line) => total + line.spans.length, 0) ?? 0,
          terminalPaintGlyphs: lastSurface?.terminalLines.join("").length ?? 0,
          width,
          height,
          snapshotSeq: context.model.terminalView.snapshotSeq,
          projectionSource: "web-product-host",
          frameSource: "terminal-2-composed",
          visibleLineCount: lastSurface?.terminalLines.length ?? 0,
          visibleSpanCount: lastSurface?.terminalRichLines?.reduce((total, line) => total + line.spans.length, 0) ?? 0,
          viewportStart: context.model.terminalView.viewportStart,
          scrollbackRows: context.model.terminalView.scrollbackRows,
        },
      });
    },
    getSnapshot(): CliShellWebProductHostSnapshot {
      return {
        surface: lastSurface,
        model: lastModel,
        textEvidence: lastSurface?.terminalLines.join("\n") ?? "",
      };
    },
    async dispatch(action: CliShellWebProductHostAction): Promise<{ ok: true }> {
      const ctx = getControllerContext();
      if (action.type === "open-dialogue") {
        routeCliShellPointerAction(ctx, "openDialogue");
      } else if (action.type === "close-dialogue") {
        routeCliShellPointerAction(ctx, "closeDialogue");
      } else if (action.type === "focus-terminal") {
        viewState = { ...viewState, focusTarget: "terminal", activeFocusTarget: "terminal" };
        localComposedInteractionDirty = true;
        host.renderNow();
      } else if (action.type === "focus-dialogue") {
        routeCliShellPointerAction(ctx, "focusDialogueInput");
      } else if (action.type === "set-dialogue-draft") {
        setCliShellDialogueDraft(ctx, action.draft);
      } else if (action.type === "append-dialogue-draft") {
        setCliShellDialogueDraft(ctx, `${viewState.dialogueDraft}${action.text}`);
      } else if (action.type === "submit-dialogue") {
        await submitCliShellDialogue(ctx);
      } else if (action.type === "paste") {
        routeCliShellPaste(ctx, action.text);
      } else if (action.type === "shell-scroll-delta") {
        routeCliShellMouseScroll(ctx, { deltaRows: action.deltaRows });
      } else if (action.type === "shell-scroll-target") {
        routeCliShellViewportTarget(ctx, { viewportStart: action.viewportStart });
      } else if (action.type === "shell-scrollbar-target") {
        const model = lastModel ?? buildModel().model;
        const projection = resolveCliShellShellScrollbarProjection({ model, width, height });
        if (projection) {
          routeCliShellViewportTarget(ctx, {
            viewportStart: resolveCliShellScrollbarPointerTarget({
              projection,
              row: projection.region.row + Math.trunc(action.row),
            }),
          });
        }
      } else if (action.type === "dialogue-scroll-delta") {
        routeDialogueScroll(action.deltaRows);
      } else if (action.type === "resize") {
        width = normalizeDimension(action.cols, width);
        height = normalizeDimension(action.rows, height);
        localComposedInteractionDirty = true;
        host.renderNow();
      }
      return { ok: true };
    },
  };

  return host;
};

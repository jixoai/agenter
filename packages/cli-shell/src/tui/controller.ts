import type { KeyEvent } from "@opentui/core";

import { disableCliShellManagedMode, enableCliShellManagedMode, readCliShellManagedState } from "../managed";
import { resolveCliShellTerminalRegion } from "./frame";
import { matchCliShellShortcut, type CliShellTuiKeybindings } from "./keybindings";
import type { CliShellLiveTerminalMirror } from "./live-terminal-mirror";
import type { CliShellPerfTracer } from "./perf-trace";
import { encodeCliShellTerminalKey } from "./terminal-input";
import {
  findNextTerminalWordBoundary,
  findPreviousTerminalWordBoundary,
  stringIndexToTerminalColumn,
  terminalColumnToStringIndex,
} from "./terminal-word-navigation";
import type { CliShellPointerAction, CliShellTuiModel, CliShellTuiStore, CliShellTuiViewState } from "./types";

export interface CliShellTuiControllerContext {
  store: CliShellTuiStore;
  sessionId: string;
  shellName: string;
  roomChatId: string;
  roomAccessToken?: string;
  runtimeId: string;
  avatarActorId: string;
  keybindings: CliShellTuiKeybindings;
  onQuit: () => void;
  trackAsyncTask?: (task: Promise<void>) => void;
  getViewState: () => CliShellTuiViewState;
  getModel: () => CliShellTuiModel;
  getLiveMirror?: () => CliShellLiveTerminalMirror | null;
  trace?: CliShellPerfTracer;
  updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => void;
}

const setStatus = (ctx: CliShellTuiControllerContext, statusNotice: string | null): void => {
  ctx.updateViewState((current) => ({
    ...current,
    statusNotice,
  }));
};

const clearTerminalSelectionAnchor = (ctx: CliShellTuiControllerContext): void => {
  if (!ctx.getViewState().terminalSelectionAnchor) {
    return;
  }
  ctx.updateViewState((current) => ({
    ...current,
    terminalSelectionAnchor: undefined,
  }));
};

const isPlainReturnShortcut = (input: CliShellTuiKeybindings["sendDialogue"]): boolean =>
  input.key === "return" && !input.command && !input.ctrl && !input.meta && !input.super && !input.alt && !input.shift;

const closeDialogue = (ctx: CliShellTuiControllerContext): void => {
  ctx.updateViewState((current) => ({
    ...current,
    dialogueOpen: false,
    focusTarget: "terminal",
    dialogueDraft: "",
    statusNotice: null,
  }));
};

export const setCliShellDialogueDraft = (ctx: CliShellTuiControllerContext, draft: string): void => {
  ctx.updateViewState((current) => ({
    ...current,
    dialogueDraft: draft,
    statusNotice: null,
  }));
};

const sendTerminalInput = (
  ctx: CliShellTuiControllerContext,
  text: string,
  options: { preserveSelectionAnchor?: boolean } = {},
): void => {
  const shouldClearSelection = options.preserveSelectionAnchor !== true;
  if (options.preserveSelectionAnchor !== true) {
    clearTerminalSelectionAnchor(ctx);
  }
  const mirror = ctx.getLiveMirror?.();
  if (shouldClearSelection) {
    mirror?.clearSelection?.("terminal");
  }
  if (mirror?.sendInputBytes(new TextEncoder().encode(text))) {
    let followed = false;
    if (ctx.getModel().interactionProfile?.followCursorOnInput !== false) {
      followed = mirror.followCursor();
    }
    ctx.trace?.record({
      kind: "follow-cursor-requested",
      detail: {
        source: "terminal-input",
        byteLength: new TextEncoder().encode(text).byteLength,
        followed,
      },
    });
    return;
  }
  ctx.trace?.record({
    kind: "terminal-input-fallback",
    detail: {
      byteLength: new TextEncoder().encode(text).byteLength,
    },
  });
  void ctx.store
    .inputGlobalTerminal({
      terminalId: ctx.getModel().terminalId,
      text,
      returnRead: false,
    })
    .catch((error: unknown) => {
      setStatus(ctx, `终端输入失败: ${error instanceof Error ? error.message : String(error)}`);
    });
};

const repeatTerminalKey = (key: "\u001b[C" | "\u001b[D", count: number): string | null => {
  const safeCount = Math.max(0, Math.trunc(count));
  return safeCount > 0 ? key.repeat(safeCount) : null;
};

type OptionWordNavigationDirection = "left" | "right";

interface TerminalWordBoundaryResolution {
  direction: OptionWordNavigationDirection;
  line: string;
  localCursorRow: number;
  viewportStart: number;
  cursorAbsRow: number;
  cursorCol: number;
  cursorIndex: number;
  targetIndex: number;
  targetCol: number;
  delta: number;
}

interface TerminalModifiedArrowKey {
  direction: OptionWordNavigationDirection;
  shift: boolean;
  option: boolean;
}

interface TerminalOptionWordKey {
  direction: OptionWordNavigationDirection;
  shift: boolean;
  option: boolean;
}

const resolveModifiedArrowKey = (key: KeyEvent): TerminalModifiedArrowKey | null => {
  const sequence = key.sequence || key.raw;
  const match = /^\u001b\[1;(\d+)([CD])$/.exec(sequence);
  if (!match) {
    return null;
  }
  const modifierValue = Number(match[1]);
  if (!Number.isInteger(modifierValue) || modifierValue <= 1) {
    return null;
  }
  const modifier = modifierValue - 1;
  return {
    direction: match[2] === "D" ? "left" : "right",
    shift: (modifier & 1) !== 0,
    option: (modifier & 2) !== 0,
  };
};

const resolveOptionWordKey = (key: KeyEvent): TerminalOptionWordKey | null => {
  const sequence = key.sequence || key.raw;
  const modifiedArrow = resolveModifiedArrowKey(key);
  if (modifiedArrow?.option) {
    return modifiedArrow;
  }
  if (sequence === "\u001bb") {
    return { direction: "left", shift: key.shift === true, option: true };
  }
  if (sequence === "\u001bf") {
    return { direction: "right", shift: key.shift === true, option: true };
  }
  if (sequence === "\u001bB") {
    return { direction: "left", shift: true, option: true };
  }
  if (sequence === "\u001bF") {
    return { direction: "right", shift: true, option: true };
  }
  if ((key.name === "left" || key.name === "right") && (key.option === true || key.meta === true)) {
    return { direction: key.name, shift: key.shift === true, option: true };
  }
  return null;
};

const resolveOptionWordNavigationDirection = (key: KeyEvent): OptionWordNavigationDirection | null =>
  resolveOptionWordKey(key)?.direction ?? null;

const isOptionWordNavigationKey = (key: KeyEvent): boolean => {
  return resolveOptionWordNavigationDirection(key) !== null;
};

const resolveOptionWordBoundary = (
  ctx: CliShellTuiControllerContext,
  key: KeyEvent,
): TerminalWordBoundaryResolution | null => {
  const direction = resolveOptionWordNavigationDirection(key);
  if (!direction) {
    return null;
  }
  const model = ctx.getModel();
  if (model.interactionProfile?.wordNavigation !== true) {
    ctx.trace?.record({
      kind: "terminal-key-word-navigation-skipped",
      detail: {
        reason: "profile-disabled",
        keyName: key.name,
      },
    });
    return null;
  }
  const localCursorRow = Math.max(0, Math.trunc(model.terminalView.cursorAbsRow - model.terminalView.viewportStart));
  const line = model.terminalView.plainLines[localCursorRow] ?? "";
  const cursorCol = Math.max(0, Math.trunc(model.terminalView.cursorCol));
  const cursorIndex = terminalColumnToStringIndex(line, cursorCol);
  const targetIndex =
    direction === "left"
      ? findPreviousTerminalWordBoundary(line, cursorIndex)
      : findNextTerminalWordBoundary(line, cursorIndex);
  if (targetIndex === null) {
    ctx.trace?.record({
      kind: "terminal-key-word-navigation-skipped",
      detail: {
        reason: "no-boundary",
        keyName: key.name,
        cursorCol,
        cursorIndex,
        line,
      },
    });
    return null;
  }
  const targetCol = stringIndexToTerminalColumn(line, targetIndex);
  const delta = targetCol - cursorCol;
  if (delta === 0) {
    ctx.trace?.record({
      kind: "terminal-key-word-navigation-skipped",
      detail: {
        reason: "zero-delta",
        keyName: key.name,
        cursorCol,
        targetCol,
        cursorIndex,
        targetIndex,
        line,
      },
    });
    return null;
  }
  return {
    direction,
    line,
    localCursorRow,
    viewportStart: model.terminalView.viewportStart,
    cursorAbsRow: model.terminalView.cursorAbsRow,
    cursorCol,
    cursorIndex,
    targetIndex,
    targetCol,
    delta,
  };
};

const resolveOptionWordNavigationInput = (ctx: CliShellTuiControllerContext, key: KeyEvent): string | null => {
  const boundary = resolveOptionWordBoundary(ctx, key);
  if (!boundary) {
    return null;
  }
  ctx.trace?.record({
    kind: "terminal-key-word-navigation",
    detail: {
      keyName: key.name,
      ...boundary,
    },
  });
  const delta = boundary.delta;
  return delta > 0 ? repeatTerminalKey("\u001b[C", delta) : repeatTerminalKey("\u001b[D", Math.abs(delta));
};

const routeOptionShiftWordSelection = (ctx: CliShellTuiControllerContext, key: KeyEvent): boolean => {
  const optionWordKey = resolveOptionWordKey(key);
  if (!optionWordKey?.option || !optionWordKey.shift) {
    return false;
  }
  const boundary = resolveOptionWordBoundary(ctx, key);
  if (!boundary) {
    return false;
  }
  const currentAnchor = ctx.getViewState().terminalSelectionAnchor;
  const anchor =
    currentAnchor && currentAnchor.row === boundary.cursorAbsRow
      ? currentAnchor
      : { row: boundary.cursorAbsRow, col: boundary.cursorCol };
  const startCol = Math.min(anchor.col, boundary.targetCol);
  const endCol = Math.max(anchor.col, boundary.targetCol);
  if (startCol === endCol) {
    clearTerminalSelectionAnchor(ctx);
    return false;
  }
  const sent =
    ctx.getLiveMirror?.()?.selectRange({
      ownerId: "terminal",
      startRow: anchor.row,
      startCol,
      endRow: boundary.cursorAbsRow,
      endCol,
    }) ?? false;
  const cursorInput =
    sent && boundary.delta > 0
      ? repeatTerminalKey("\u001b[C", boundary.delta)
      : sent && boundary.delta < 0
        ? repeatTerminalKey("\u001b[D", Math.abs(boundary.delta))
        : null;
  if (cursorInput) {
    ctx.updateViewState((current) => ({
      ...current,
      terminalSelectionAnchor: anchor,
    }));
    sendTerminalInput(ctx, cursorInput, { preserveSelectionAnchor: true });
  }
  ctx.trace?.record({
    kind: "terminal-key-word-selection",
    detail: {
      keyName: key.name,
      sent,
      cursorMoved: cursorInput !== null,
      ...boundary,
      anchorRow: anchor.row,
      anchorCol: anchor.col,
      startCol,
      endCol,
    },
  });
  return sent;
};

const toggleManaged = async (ctx: CliShellTuiControllerContext): Promise<void> => {
  const managedNow = ctx.getViewState().managed;
  setStatus(ctx, managedNow.managed ? "正在关闭托管…" : "正在开启托管…");
  try {
    if (managedNow.managed) {
      await disableCliShellManagedMode({
        store: ctx.store,
        sessionId: ctx.sessionId,
        runtimeId: ctx.runtimeId,
        avatarActorId: ctx.avatarActorId,
        shellName: ctx.shellName,
        terminalId: ctx.getModel().terminalId,
        roomId: ctx.roomChatId,
      });
    } else {
      await enableCliShellManagedMode({
        store: ctx.store,
        sessionId: ctx.sessionId,
        runtimeId: ctx.runtimeId,
        avatarActorId: ctx.avatarActorId,
        shellName: ctx.shellName,
        terminalId: ctx.getModel().terminalId,
        roomId: ctx.roomChatId,
        objective: ctx.getModel().toolbarHeartbeat,
      });
    }
    const nextManaged = await readCliShellManagedState({
      store: ctx.store,
      sessionId: ctx.sessionId,
      runtimeId: ctx.runtimeId,
      avatarActorId: ctx.avatarActorId,
      shellName: ctx.shellName,
    });
    ctx.updateViewState((current) => ({
      ...current,
      managed: nextManaged,
      statusNotice: nextManaged.managed ? "托管已开启" : "托管已关闭",
    }));
  } catch (error) {
    setStatus(ctx, `托管切换失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const submitCliShellDialogue = async (ctx: CliShellTuiControllerContext): Promise<void> => {
  const text = ctx.getViewState().dialogueDraft.trim();
  if (text.length === 0) {
    return;
  }
  setStatus(ctx, "正在发送消息…");
  try {
    const result = await ctx.store.sendGlobalRoomMessage({
      chatId: ctx.roomChatId,
      accessToken: ctx.roomAccessToken,
      text,
    });
    if (!result.ok) {
      throw new Error(result.reason ?? "message send failed");
    }
    await ctx.store.hydrateGlobalRoomSnapshot({
      chatId: ctx.roomChatId,
      accessToken: ctx.roomAccessToken,
      force: true,
    });
    ctx.updateViewState((current) => ({
      ...current,
      dialogueDraft: "",
      dialogueScrollOffset: 0,
      statusNotice: "消息已发送",
    }));
  } catch (error) {
    setStatus(ctx, `消息发送失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const openDialogue = (ctx: CliShellTuiControllerContext): void => {
  ctx.updateViewState((current) => ({
    ...current,
    dialogueOpen: true,
    focusTarget: "dialogue",
    statusNotice: null,
  }));
};

const setDialoguePlacement = (
  ctx: CliShellTuiControllerContext,
  placement: CliShellTuiViewState["requestedPlacement"],
): void => {
  ctx.updateViewState((current) => ({
    ...current,
    dialogueOpen: true,
    focusTarget: "dialogue",
    requestedPlacement: placement,
    statusNotice: null,
  }));
};

export const routeCliShellPointerAction = (ctx: CliShellTuiControllerContext, action: CliShellPointerAction): void => {
  if (action === "toggleManaged") {
    const task = toggleManaged(ctx);
    ctx.trackAsyncTask?.(task);
    void task;
    return;
  }
  if (action === "openDialogue") {
    openDialogue(ctx);
    return;
  }
  if (action === "closeDialogue") {
    closeDialogue(ctx);
    return;
  }
  if (action === "focusDialogueInput") {
    ctx.updateViewState((current) => ({
      ...current,
      dialogueOpen: true,
      focusTarget: "dialogue",
      statusNotice: null,
    }));
    return;
  }
  if (action === "stickDialogueToBottom") {
    ctx.updateViewState((current) => ({
      ...current,
      dialogueOpen: true,
      focusTarget: "dialogue",
      dialogueScrollOffset: 0,
      statusNotice: null,
    }));
    return;
  }
  if (action === "submitDialogue") {
    const task = submitCliShellDialogue(ctx);
    ctx.trackAsyncTask?.(task);
    void task;
    return;
  }
  if (action === "placeLeft") {
    setDialoguePlacement(ctx, "left");
    return;
  }
  if (action === "placeRight") {
    setDialoguePlacement(ctx, "right");
    return;
  }
  if (action === "placeFloating") {
    setDialoguePlacement(ctx, "floating");
    return;
  }
  if (action === "placeCover") {
    setDialoguePlacement(ctx, "cover");
    return;
  }
};

export const routeCliShellMouseScroll = (ctx: CliShellTuiControllerContext, input: { deltaRows: number }): boolean => {
  const deltaRows = Math.trunc(input.deltaRows);
  if (!Number.isFinite(deltaRows) || deltaRows === 0) {
    return false;
  }
  const mirror = ctx.getLiveMirror?.();
  return mirror?.scrollViewport(deltaRows) ?? false;
};

export const routeCliShellViewportTarget = (
  ctx: CliShellTuiControllerContext,
  input: { viewportStart: number },
): boolean => {
  const viewportStart = Math.max(0, Math.trunc(input.viewportStart));
  if (!Number.isFinite(viewportStart)) {
    return false;
  }
  const mirror = ctx.getLiveMirror?.();
  return mirror?.setViewportStart(viewportStart) ?? false;
};

export const routeCliShellPaste = (ctx: CliShellTuiControllerContext, text: string): void => {
  if (ctx.getViewState().dialogueOpen && ctx.getViewState().focusTarget === "dialogue") {
    setCliShellDialogueDraft(ctx, `${ctx.getViewState().dialogueDraft}${text}`);
    return;
  }
  sendTerminalInput(ctx, text);
};

export const routeCliShellKey = (ctx: CliShellTuiControllerContext, key: KeyEvent): boolean => {
  if (matchCliShellShortcut(key, ctx.keybindings.quit)) {
    ctx.onQuit();
    return true;
  }

  const viewState = ctx.getViewState();
  if (viewState.dialogueOpen && viewState.focusTarget === "dialogue") {
    if (matchCliShellShortcut(key, ctx.keybindings.toggleManaged)) {
      const task = toggleManaged(ctx);
      ctx.trackAsyncTask?.(task);
      void task;
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.closeDialogue)) {
      closeDialogue(ctx);
      return true;
    }
    if (
      matchCliShellShortcut(key, ctx.keybindings.sendDialogue) &&
      !isPlainReturnShortcut(ctx.keybindings.sendDialogue)
    ) {
      const task = submitCliShellDialogue(ctx);
      ctx.trackAsyncTask?.(task);
      void task;
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.placeLeft)) {
      ctx.updateViewState((current) => ({
        ...current,
        focusTarget: "dialogue",
        requestedPlacement: "left",
        statusNotice: null,
      }));
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.placeRight)) {
      ctx.updateViewState((current) => ({
        ...current,
        focusTarget: "dialogue",
        requestedPlacement: "right",
        statusNotice: null,
      }));
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.placeFloating)) {
      ctx.updateViewState((current) => ({
        ...current,
        focusTarget: "dialogue",
        requestedPlacement: "floating",
        statusNotice: null,
      }));
      return true;
    }
    if (key.name === "escape") {
      closeDialogue(ctx);
      return true;
    }
    return false;
  }

  if (matchCliShellShortcut(key, ctx.keybindings.openDialogue)) {
    openDialogue(ctx);
    return true;
  }
  if (viewState.dialogueOpen && matchCliShellShortcut(key, ctx.keybindings.closeDialogue)) {
    closeDialogue(ctx);
    return true;
  }
  if (matchCliShellShortcut(key, ctx.keybindings.toggleManaged)) {
    routeCliShellPointerAction(ctx, "toggleManaged");
    return true;
  }

  if (routeOptionShiftWordSelection(ctx, key)) {
    return true;
  }

  const encoded =
    resolveOptionWordNavigationInput(ctx, key) ??
    encodeCliShellTerminalKey(key, { homeEndFallback: ctx.getModel().interactionProfile?.homeEndFallback });
  if (encoded) {
    ctx.trace?.record({
      kind: "terminal-key-encoded",
      detail: {
        keyName: key.name,
        sequence: key.sequence,
        raw: key.raw,
        ctrl: key.ctrl === true,
        shift: key.shift === true,
        meta: key.meta === true,
        option: key.option === true,
        optionLike: isOptionWordNavigationKey(key),
        super: key.super === true,
        hyper: key.hyper === true,
        encodedLength: encoded.length,
        encodedCodes: Array.from(encoded).map((char) => char.charCodeAt(0)),
      },
    });
    sendTerminalInput(ctx, encoded);
    return true;
  }
  ctx.trace?.record({
    kind: "terminal-key-unsupported",
    detail: {
      keyName: key.name,
      sequence: key.sequence,
      raw: key.raw,
      ctrl: key.ctrl === true,
      shift: key.shift === true,
      meta: key.meta === true,
      option: key.option === true,
      optionLike: isOptionWordNavigationKey(key),
      super: key.super === true,
      hyper: key.hyper === true,
    },
  });
  return false;
};

export const syncCliShellTerminalGeometry = async (input: {
  store: CliShellTuiStore;
  width: number;
  height: number;
  model: CliShellTuiModel;
  terminalId?: string;
  previousGeometryKey: string;
  liveMirror?: CliShellLiveTerminalMirror | null;
}): Promise<string> => {
  const region = resolveCliShellTerminalRegion({
    model: input.model,
    width: input.width,
    height: input.height,
  });
  const cols = Math.max(1, region.width);
  const rows = Math.max(1, region.height);
  const terminalId = input.terminalId ?? input.model.terminalId;
  const geometryKey = `${terminalId}:${cols}x${rows}`;
  if (geometryKey === input.previousGeometryKey || input.width <= 0 || input.height <= 0) {
    return input.previousGeometryKey;
  }
  if (input.liveMirror?.resize(cols, rows)) {
    return geometryKey;
  }
  await input.store.setGlobalTerminalConfig({
    terminalId,
    cols,
    rows,
  });
  return geometryKey;
};

import type { KeyEvent } from "@opentui/core";

import { disableCliShellManagedMode, enableCliShellManagedMode, readCliShellManagedState } from "../managed";
import { resolveCliShellTerminalRegion } from "./frame";
import type { CliShellLiveTerminalMirror } from "./live-terminal-mirror";
import { matchCliShellShortcut, type CliShellTuiKeybindings } from "./keybindings";
import { encodeCliShellTerminalKey } from "./terminal-input";
import {
  findNextTerminalWordBoundary,
  findPreviousTerminalWordBoundary,
  stringIndexToTerminalColumn,
  terminalColumnToStringIndex,
} from "./terminal-word-navigation";
import type {
  CliShellPointerAction,
  CliShellTuiModel,
  CliShellTuiStore,
  CliShellTuiViewState,
} from "./types";

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
  updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => void;
}

const setStatus = (ctx: CliShellTuiControllerContext, statusNotice: string | null): void => {
  ctx.updateViewState((current) => ({
    ...current,
    statusNotice,
  }));
};

const isPlainReturnShortcut = (input: CliShellTuiKeybindings["sendDialogue"]): boolean =>
  input.key === "return" &&
  !input.command &&
  !input.ctrl &&
  !input.meta &&
  !input.super &&
  !input.alt &&
  !input.shift;

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

const sendTerminalInput = (ctx: CliShellTuiControllerContext, text: string): void => {
  const mirror = ctx.getLiveMirror?.();
  if (mirror?.sendInputBytes(new TextEncoder().encode(text))) {
    if (ctx.getModel().interactionProfile?.followCursorOnInput !== false) {
      mirror.followCursor();
    }
    return;
  }
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

const resolveOptionWordNavigationInput = (ctx: CliShellTuiControllerContext, key: KeyEvent): string | null => {
  if (!key.option || (key.name !== "left" && key.name !== "right")) {
    return null;
  }
  const model = ctx.getModel();
  if (model.interactionProfile?.wordNavigation !== true) {
    return null;
  }
  const localCursorRow = Math.max(0, Math.trunc(model.terminalView.cursorAbsRow - model.terminalView.viewportStart));
  const line = model.terminalView.plainLines[localCursorRow] ?? "";
  const cursorCol = Math.max(0, Math.trunc(model.terminalView.cursorCol));
  const cursorIndex = terminalColumnToStringIndex(line, cursorCol);
  const targetIndex =
    key.name === "left"
      ? findPreviousTerminalWordBoundary(line, cursorIndex)
      : findNextTerminalWordBoundary(line, cursorIndex);
  if (targetIndex === null) {
    return null;
  }
  const targetCol = stringIndexToTerminalColumn(line, targetIndex);
  const delta = targetCol - cursorCol;
  if (delta === 0) {
    return null;
  }
  return delta > 0 ? repeatTerminalKey("\u001b[C", delta) : repeatTerminalKey("\u001b[D", Math.abs(delta));
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
    if (matchCliShellShortcut(key, ctx.keybindings.sendDialogue) && !isPlainReturnShortcut(ctx.keybindings.sendDialogue)) {
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

  const encoded =
    resolveOptionWordNavigationInput(ctx, key) ??
    encodeCliShellTerminalKey(key, { homeEndFallback: ctx.getModel().interactionProfile?.homeEndFallback });
  if (encoded) {
    sendTerminalInput(ctx, encoded);
    return true;
  }
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

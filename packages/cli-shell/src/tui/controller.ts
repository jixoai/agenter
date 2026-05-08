import type { KeyEvent } from "@opentui/core";

import { disableCliShellManagedMode, enableCliShellManagedMode, readCliShellManagedState } from "../managed";
import { resolveCliShellTerminalRegion } from "./frame";
import type { CliShellLiveTerminalMirror } from "./live-terminal-mirror";
import { matchCliShellShortcut, type CliShellTuiKeybindings } from "./keybindings";
import { encodeCliShellTerminalKey } from "./terminal-input";
import type { CliShellTuiModel, CliShellTuiStore, CliShellTuiViewState } from "./types";

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

const resolveDraftInput = (key: {
  name: string;
  sequence?: string;
  raw?: string;
  ctrl?: boolean;
  meta?: boolean;
}): string | null => {
  if (key.ctrl || key.meta) {
    return null;
  }
  if (key.name === "space") {
    return " ";
  }
  if (key.name === "tab") {
    return "\t";
  }
  if (key.sequence && key.sequence.length > 0 && !key.sequence.startsWith("\u001b")) {
    return key.sequence;
  }
  if (key.raw && key.raw.length > 0 && !key.raw.startsWith("\u001b")) {
    return key.raw;
  }
  return null;
};

const setStatus = (ctx: CliShellTuiControllerContext, statusNotice: string | null): void => {
  ctx.updateViewState((current) => ({
    ...current,
    statusNotice,
  }));
};

const closeDialogue = (ctx: CliShellTuiControllerContext): void => {
  ctx.updateViewState((current) => ({
    ...current,
    dialogueOpen: false,
    dialogueDraft: "",
    statusNotice: null,
  }));
};

const sendTerminalInput = (ctx: CliShellTuiControllerContext, text: string): void => {
  const mirror = ctx.getLiveMirror?.();
  if (mirror?.sendInputBytes(new TextEncoder().encode(text))) {
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

const sendDialogueDraft = async (ctx: CliShellTuiControllerContext): Promise<void> => {
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
      dialogueOpen: false,
      dialogueDraft: "",
      statusNotice: "消息已发送",
    }));
  } catch (error) {
    setStatus(ctx, `消息发送失败: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const routeCliShellPaste = (ctx: CliShellTuiControllerContext, text: string): void => {
  if (ctx.getViewState().dialogueOpen) {
    ctx.updateViewState((current) => ({
      ...current,
      dialogueDraft: `${current.dialogueDraft}${text}`,
      statusNotice: null,
    }));
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
  if (viewState.dialogueOpen) {
    if (matchCliShellShortcut(key, ctx.keybindings.closeDialogue)) {
      closeDialogue(ctx);
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.sendDialogue)) {
      const task = sendDialogueDraft(ctx);
      ctx.trackAsyncTask?.(task);
      void task;
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.placeLeft)) {
      ctx.updateViewState((current) => ({
        ...current,
        requestedPlacement: "left",
        statusNotice: null,
      }));
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.placeRight)) {
      ctx.updateViewState((current) => ({
        ...current,
        requestedPlacement: "right",
        statusNotice: null,
      }));
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.placeFloating)) {
      ctx.updateViewState((current) => ({
        ...current,
        requestedPlacement: "floating",
        statusNotice: null,
      }));
      return true;
    }
    if (matchCliShellShortcut(key, ctx.keybindings.placeBottom)) {
      ctx.updateViewState((current) => ({
        ...current,
        dialogueOpen: false,
        requestedPlacement: "bottom",
        dialogueDraft: "",
        statusNotice: null,
      }));
      return true;
    }
    if (key.name === "backspace") {
      ctx.updateViewState((current) => ({
        ...current,
        dialogueDraft: current.dialogueDraft.slice(0, -1),
        statusNotice: null,
      }));
      return true;
    }
    const draftInput = resolveDraftInput(key);
    if (draftInput) {
      ctx.updateViewState((current) => ({
        ...current,
        dialogueDraft: `${current.dialogueDraft}${draftInput}`,
        statusNotice: null,
      }));
    }
    return true;
  }

  if (matchCliShellShortcut(key, ctx.keybindings.openDialogue)) {
    ctx.updateViewState((current) => ({
      ...current,
      dialogueOpen: true,
      requestedPlacement: current.requestedPlacement === "bottom" ? "smart" : current.requestedPlacement,
      statusNotice: null,
    }));
    return true;
  }
  if (matchCliShellShortcut(key, ctx.keybindings.toggleManaged)) {
    const task = toggleManaged(ctx);
    ctx.trackAsyncTask?.(task);
    void task;
    return true;
  }

  const encoded = encodeCliShellTerminalKey(key);
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
  const geometryKey = `${input.model.terminalId}:${cols}x${rows}`;
  if (geometryKey === input.previousGeometryKey || input.width <= 0 || input.height <= 0) {
    return input.previousGeometryKey;
  }
  if (input.liveMirror?.resize(cols, rows)) {
    return geometryKey;
  }
  await input.store.setGlobalTerminalConfig({
    terminalId: input.model.terminalId,
    cols,
    rows,
  });
  return geometryKey;
};

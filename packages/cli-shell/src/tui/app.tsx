/** @jsxImportSource @opentui/react */

import type { GlobalRoomMessage } from "@agenter/client-sdk";
import { useKeyboard, usePaste, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { routeCliShellKey, routeCliShellPaste, syncCliShellTerminalGeometry } from "./controller";
import { layoutCliShellTuiFrame } from "./frame";
import type { CliShellTuiKeybindings } from "./keybindings";
import { buildCliShellTuiModel } from "./model";
import type { CliShellManagedState } from "../managed";
import type { CliShellTuiStore, CliShellTuiViewState } from "./types";

export interface CliShellTuiAppProps {
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
}

const textDecoder = new TextDecoder();

export const CliShellTuiApp = (props: CliShellTuiAppProps) => {
  const state = useSyncExternalStore(
    (listener) => props.store.subscribe(listener),
    () => props.store.getState(),
  );
  const { width, height } = useTerminalDimensions();
  const [viewState, setViewState] = useState<CliShellTuiViewState>({
    dialogueOpen: false,
    requestedPlacement: "smart",
    dialogueDraft: "",
    managed: props.managed,
    statusNotice: null,
  });
  const geometryRef = useRef<string>("");
  const roomSnapshot = state.globalRoomSnapshotsById[props.roomChatId]?.data ?? null;

  const model = useMemo(
    () =>
      buildCliShellTuiModel({
        state,
        projection: {
          roomSnapshot,
        },
        sessionId: props.sessionId,
        shellName: props.shellName,
        fallbackTerminalId: props.fallbackTerminalId,
        avatarActorId: props.avatarActorId,
        ui: viewState,
        keybindings: props.keybindings,
        width,
        height,
      }),
    [
      height,
      props.avatarActorId,
      props.fallbackTerminalId,
      props.keybindings,
      props.sessionId,
      props.shellName,
      roomSnapshot,
      state,
      viewState,
      width,
    ],
  );
  const frame = useMemo(() => layoutCliShellTuiFrame({ model, width, height }), [height, model, width]);
  const controllerContext = useMemo(
    () => ({
      store: props.store,
      sessionId: props.sessionId,
      shellName: props.shellName,
      roomChatId: props.roomChatId,
      roomAccessToken: props.roomAccessToken,
      runtimeId: props.runtimeId,
      avatarActorId: props.avatarActorId,
      keybindings: props.keybindings,
      onQuit: props.onQuit,
      getViewState: () => viewState,
      getModel: () => model,
      updateViewState: (updater: (current: CliShellTuiViewState) => CliShellTuiViewState) => {
        setViewState((current) => updater(current));
      },
    }),
    [
      model,
      props.avatarActorId,
      props.keybindings,
      props.onQuit,
      props.roomAccessToken,
      props.roomChatId,
      props.runtimeId,
      props.sessionId,
      props.shellName,
      props.store,
      viewState,
    ],
  );

  useEffect(() => {
    const release = props.store.retainGlobalRoomSnapshot(props.roomChatId);
    void props.store.hydrateGlobalRoomSnapshot({
      chatId: props.roomChatId,
      accessToken: props.roomAccessToken,
      force: true,
    });
    return release;
  }, [props.roomAccessToken, props.roomChatId, props.store]);

  useEffect(() => {
    void syncCliShellTerminalGeometry({
      store: props.store,
      terminalId: model.terminalId,
      width,
      height,
      previousGeometryKey: geometryRef.current,
    })
      .then((nextKey) => {
        geometryRef.current = nextKey;
      })
      .catch(() => undefined);
  }, [height, model.terminalId, props.store, width]);

  usePaste((event) => {
    routeCliShellPaste(controllerContext, textDecoder.decode(event.bytes));
  });

  useKeyboard((key) => {
    return routeCliShellKey(controllerContext, key);
  });

  return (
    <box width="100%" height="100%">
      <text selectable>
        {frame.styledLines.map((line, index) => (
          <span key={`line-${index}`}>
            {line.spans.length > 0
              ? line.spans.map((span, spanIndex) => {
                  let content: ReactNode = (
                    <span key={`text-${index}-${spanIndex}`} fg={span.fg} bg={span.bg}>
                      {span.text}
                    </span>
                  );
                  return <span key={`span-${index}-${spanIndex}`}>{content}</span>;
                })
              : " "}
            {index < frame.lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </text>
    </box>
  );
};

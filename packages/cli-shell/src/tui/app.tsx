/** @jsxImportSource @opentui/react */

import type { GlobalRoomMessage } from "@agenter/client-sdk";
import { useKeyboard, usePaste, useTerminalDimensions } from "@opentui/react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { routeCliShellKey, routeCliShellPaste, syncCliShellTerminalGeometry } from "./controller";
import { layoutCliShellTuiFrame } from "./frame";
import type { CliShellTuiKeybindings } from "./keybindings";
import { createCliShellLiveTerminalMirror, type CliShellLiveTerminalMirror } from "./live-terminal-mirror";
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
const resolveActiveTerminalId = (input: {
  state: ReturnType<CliShellTuiStore["getState"]>;
  sessionId: string;
  fallbackTerminalId: string;
}): string => input.state.runtimes[input.sessionId]?.focusedTerminalId?.trim() || input.fallbackTerminalId;

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
  const liveMirrorRef = useRef<CliShellLiveTerminalMirror | null>(null);
  const liveMirrorTransportUrlRef = useRef<string | null>(null);
  const [, setLiveTerminalRevision] = useState(0);
  const roomSnapshot = state.globalRoomSnapshotsById[props.roomChatId]?.data ?? null;
  const activeTerminalId = resolveActiveTerminalId({
    state,
    sessionId: props.sessionId,
    fallbackTerminalId: props.fallbackTerminalId,
  });
  const terminalEntry = state.globalTerminals.data.find((entry) => entry.terminalId === activeTerminalId) ?? null;
  const liveTerminal = liveMirrorRef.current?.getView() ?? null;

  const model = useMemo(
    () =>
      buildCliShellTuiModel({
        state,
        projection: {
          roomSnapshot,
          liveTerminal,
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
      liveTerminal,
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
      getLiveMirror: () => liveMirrorRef.current,
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
    const release = props.store.retainGlobalTerminals();
    if (props.fallbackTerminalId.trim().length > 0) {
      void props.store
        .hydrateGlobalTerminals({ force: true })
        .then(async (terminals) => {
          const terminal = terminals.find((entry) => entry.terminalId === props.fallbackTerminalId);
          if (terminal?.snapshot?.lines?.some((line) => line.length > 0)) {
            return;
          }
          await props.store.readGlobalTerminal({
            terminalId: props.fallbackTerminalId,
            mode: "snapshot",
            recordActivity: false,
          });
        })
        .catch(() => undefined);
    }
    return release;
  }, [props.fallbackTerminalId, props.store]);

  useEffect(() => {
    if (!terminalEntry?.transportUrl) {
      liveMirrorRef.current?.disconnect();
      liveMirrorRef.current = null;
      liveMirrorTransportUrlRef.current = null;
      setLiveTerminalRevision((current) => current + 1);
      return;
    }

    if (liveMirrorRef.current && liveMirrorTransportUrlRef.current === terminalEntry.transportUrl) {
      return;
    }

    liveMirrorRef.current?.disconnect();
    const mirror = createCliShellLiveTerminalMirror({
      terminalId: terminalEntry.terminalId,
      transportUrl: terminalEntry.transportUrl,
      initialSnapshot: terminalEntry.snapshot ?? null,
    });
    liveMirrorRef.current = mirror;
    liveMirrorTransportUrlRef.current = terminalEntry.transportUrl;
    const release = mirror.subscribe(() => {
      if (!mirror.getView().running) {
        props.onQuit();
        return;
      }
      setLiveTerminalRevision((current) => current + 1);
    });
    void mirror.connect().catch(() => undefined);
    setLiveTerminalRevision((current) => current + 1);
    return () => {
      release();
      mirror.disconnect();
      if (liveMirrorRef.current === mirror) {
        liveMirrorRef.current = null;
        liveMirrorTransportUrlRef.current = null;
      }
    };
  }, [activeTerminalId, props, terminalEntry?.snapshot?.seq, terminalEntry?.terminalId, terminalEntry?.transportUrl]);

  useEffect(() => {
    if (liveTerminal && !liveTerminal.running) {
      props.onQuit();
    }
  }, [liveTerminal, props]);

  useEffect(() => {
    if (terminalEntry?.processPhase === "stopped") {
      props.onQuit();
    }
  }, [props, terminalEntry?.processPhase]);

  useEffect(() => {
    void syncCliShellTerminalGeometry({
      store: props.store,
      width,
      height,
      model,
      previousGeometryKey: geometryRef.current,
      liveMirror: liveMirrorRef.current,
    })
      .then((nextKey) => {
        geometryRef.current = nextKey;
      })
      .catch(() => undefined);
  }, [height, model, props.store, width]);

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
                const content: ReactNode = (
                  <span key={`text-${index}-${spanIndex}`} fg={span.fg} bg={span.bg}>
                    {span.text}
                  </span>
                );
                  let decorated = content;
                  if ("bold" in span && (span as { bold?: boolean }).bold) {
                    decorated = <strong>{decorated}</strong>;
                  }
                  if ("underline" in span && (span as { underline?: boolean }).underline) {
                    decorated = <u>{decorated}</u>;
                  }
                  return <span key={`span-${index}-${spanIndex}`}>{decorated}</span>;
                })
              : " "}
            {index < frame.lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </text>
    </box>
  );
};

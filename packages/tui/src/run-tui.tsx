import { useEffect, useMemo, useRef, useState } from "react";
import { createCliRenderer, type TextareaRenderable } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

import { ChatPanel } from "./panels/ChatPanel";
import { SessionsPanel } from "./panels/SessionsPanel";
import { StatusBar } from "./panels/StatusBar";
import { TasksPanel } from "./panels/TasksPanel";
import { buildViewModel } from "./types";

export interface TuiClientOptions {
  host?: string;
  port?: number;
}

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const wsUrl = (host: string, port: number): string => `ws://${host}:${port}/trpc`;

const App = ({ host, port }: { host: string; port: number }) => {
  const renderer = useRenderer();
  const inputRef = useRef<TextareaRenderable | null>(null);
  const pendingActiveSessionIdRef = useRef<string | null>(null);

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [localInput, setLocalInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(() => ({
    connected: false,
    lastEventId: 0,
    sessions: [],
    runtimes: {},
    chatsBySession: {},
    tasksBySession: {},
  }));

  const client = useMemo(
    () =>
      createAgenterClient({
        wsUrl: wsUrl(host, port),
        onOpen: () => setConnected(true),
        onClose: () => setConnected(false),
      }),
    [host, port],
  );
  const store = useMemo(() => createRuntimeStore(client), [client]);

  useEffect(() => {
    const unsubscribe = store.subscribe((next) => {
      setState({ ...next });
      setActiveSessionId((prev) => {
        if (prev && pendingActiveSessionIdRef.current === prev) {
          if (next.sessions.some((item) => item.id === prev)) {
            pendingActiveSessionIdRef.current = null;
            return prev;
          }
          return prev;
        }
        if (prev && next.sessions.some((item) => item.id === prev)) {
          return prev;
        }
        return next.sessions[0]?.id ?? null;
      });
    });

    void store.connect();

    return () => {
      unsubscribe();
      store.disconnect();
    };
  }, [store]);

  const view = useMemo(() => buildViewModel(state, activeSessionId), [activeSessionId, state]);

  const submit = () => {
    const value = (inputRef.current?.plainText ?? localInput).trim();
    if (!value || !activeSessionId) {
      return;
    }
    inputRef.current?.clear();
    setLocalInput("");
    void store.sendChat(activeSessionId, value);
  };

  const createSession = () => {
    void store
      .createSession({
        cwd: process.cwd(),
        name: `workspace-${createId().slice(-4)}`,
        autoStart: true,
      })
      .then((session) => {
        pendingActiveSessionIdRef.current = session.id;
        setActiveSessionId(session.id);
      });
  };

  const focusNextSession = () => {
    if (view.sessions.length === 0) {
      return;
    }
    const index = view.sessions.findIndex((item) => item.id === activeSessionId);
    const next = view.sessions[(index + 1 + view.sessions.length) % view.sessions.length];
    setActiveSessionId(next.id);
  };

  useKeyboard((key) => {
    if (key.name === "return") {
      submit();
      return true;
    }
    if (key.ctrl && key.name === "n") {
      createSession();
      return true;
    }
    if (key.ctrl && key.name === "tab") {
      focusNextSession();
      return true;
    }
    if (key.ctrl && key.name === "c") {
      renderer.destroy();
      return true;
    }
    return false;
  });

  return (
    <box width="100%" height="100%" padding={1} flexDirection="column">
      <StatusBar
        host={host}
        port={port}
        connected={connected && view.connected}
        sessionCount={view.sessions.length}
        phaseText={view.phaseText}
      />
      <box marginTop={1} flexGrow={1} flexDirection="row">
        <SessionsPanel sessions={view.sessions} activeSessionId={view.activeSessionId} />
        <box marginLeft={1} flexGrow={1} flexDirection="column">
          <ChatPanel
            activeSessionId={view.activeSessionId}
            messages={view.messages}
            inputRef={inputRef}
            focused
            onInputChange={() => {
              setLocalInput(inputRef.current?.plainText ?? "");
            }}
            onSubmit={submit}
          />
          <box marginTop={1} flexGrow={1}>
            <TasksPanel tasks={view.tasks} />
          </box>
        </box>
      </box>
    </box>
  );
};

export const runTuiClient = async (options: TuiClientOptions = {}): Promise<void> => {
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4580;

  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useMouse: true,
  });
  const root = createRoot(renderer);
  root.render(<App host={host} port={port} />);
};

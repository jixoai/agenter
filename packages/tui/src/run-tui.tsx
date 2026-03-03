import { useEffect, useMemo, useRef, useState } from "react";
import { createCliRenderer, type TextareaRenderable } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";
import { createAgenterClient, createRuntimeStore } from "@agenter/client-sdk";

import { ChatPanel } from "./panels/ChatPanel";
import { InstancesPanel } from "./panels/InstancesPanel";
import { StatusBar } from "./panels/StatusBar";
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

  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [localInput, setLocalInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState(() => ({
    connected: false,
    lastEventId: 0,
    instances: [],
    runtimes: {},
    chatsByInstance: {},
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
      setActiveInstanceId((prev) => {
        if (prev && next.instances.some((item) => item.id === prev)) {
          return prev;
        }
        return next.instances[0]?.id ?? null;
      });
    });

    void store.connect();

    return () => {
      unsubscribe();
      store.disconnect();
    };
  }, [store]);

  const view = useMemo(() => buildViewModel(state, activeInstanceId), [activeInstanceId, state]);

  const submit = () => {
    const value = (inputRef.current?.plainText ?? localInput).trim();
    if (!value || !activeInstanceId) {
      return;
    }
    inputRef.current?.clear();
    setLocalInput("");
    void store.sendChat(activeInstanceId, value);
  };

  const createInstance = () => {
    void store.createInstance({
      cwd: process.cwd(),
      name: `workspace-${createId().slice(-4)}`,
      autoStart: true,
    });
  };

  const focusNextInstance = () => {
    if (view.instances.length === 0) {
      return;
    }
    const index = view.instances.findIndex((item) => item.id === activeInstanceId);
    const next = view.instances[(index + 1 + view.instances.length) % view.instances.length];
    setActiveInstanceId(next.id);
  };

  useKeyboard((key) => {
    if (key.name === "return") {
      submit();
      return true;
    }
    if (key.ctrl && key.name === "n") {
      createInstance();
      return true;
    }
    if (key.ctrl && key.name === "tab") {
      focusNextInstance();
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
        instanceCount={view.instances.length}
        phaseText={view.phaseText}
      />
      <box marginTop={1} flexGrow={1} flexDirection="row">
        <InstancesPanel instances={view.instances} activeInstanceId={view.activeInstanceId} />
        <box marginLeft={1} flexGrow={1}>
          <ChatPanel
            activeInstanceId={view.activeInstanceId}
            messages={view.messages}
            inputRef={inputRef}
            focused
            onInputChange={() => {
              setLocalInput(inputRef.current?.plainText ?? "");
            }}
            onSubmit={submit}
          />
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

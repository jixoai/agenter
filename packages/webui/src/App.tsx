import { useEffect, useMemo, useState } from "react";
import {
  createAgenterClient,
  createRuntimeStore,
  type RuntimeClientState,
  type SessionInstance,
} from "@agenter/client-sdk";
import type { SettingsKind } from "@agenter/app-server";

import { ChatPanel } from "./features/chat/ChatPanel";
import { InstancesPanel } from "./features/instances/InstancesPanel";
import { SettingsPanel, type EditableFile } from "./features/settings/SettingsPanel";
import { defaultWsUrl } from "./shared/ws-url";

const DEFAULT_KIND: SettingsKind = "settings";

const initialState: RuntimeClientState = {
  connected: false,
  lastEventId: 0,
  instances: [],
  runtimes: {},
  chatsByInstance: {},
};

interface AppProps {
  wsUrl?: string;
}

export const App = ({ wsUrl = defaultWsUrl() }: AppProps) => {
  const [runtimeState, setRuntimeState] = useState<RuntimeClientState>(initialState);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [settingsKind, setSettingsKind] = useState<SettingsKind>(DEFAULT_KIND);
  const [settingsContent, setSettingsContent] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("idle");
  const [loadedFiles, setLoadedFiles] = useState<Record<string, EditableFile>>({});

  const client = useMemo(() => createAgenterClient({ wsUrl }), [wsUrl]);
  const store = useMemo(() => createRuntimeStore(client), [client]);

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      setRuntimeState({ ...state });
      setActiveInstanceId((prev) => {
        if (prev && state.instances.some((item) => item.id === prev)) {
          return prev;
        }
        return state.instances[0]?.id ?? null;
      });
    });

    void store.connect().catch((error) => {
      setSettingsStatus(error instanceof Error ? error.message : String(error));
    });

    return () => {
      unsubscribe();
      store.disconnect();
    };
  }, [store]);

  const activeInstance = useMemo<SessionInstance | null>(() => {
    if (!activeInstanceId) {
      return null;
    }
    return runtimeState.instances.find((item) => item.id === activeInstanceId) ?? null;
  }, [activeInstanceId, runtimeState.instances]);

  const messages = activeInstanceId ? runtimeState.chatsByInstance[activeInstanceId] ?? [] : [];
  const aiStatus = runtimeState.connected ? "connected" : "connecting";

  const settingsKey = activeInstanceId ? `${activeInstanceId}:${settingsKind}` : "";

  const handleCreateInstance = async () => {
    const cwd = window.prompt("Instance cwd", ".");
    if (!cwd) {
      return;
    }
    const name = window.prompt("Instance name", "workspace") || undefined;
    await store.createInstance({ cwd, name, autoStart: true });
  };

  const handleStart = async () => {
    if (!activeInstanceId) {
      return;
    }
    await store.startInstance(activeInstanceId);
  };

  const handleStop = async () => {
    if (!activeInstanceId) {
      return;
    }
    await store.stopInstance(activeInstanceId);
  };

  const handleDelete = async () => {
    if (!activeInstanceId) {
      return;
    }
    await store.deleteInstance(activeInstanceId);
  };

  const handleSend = async () => {
    if (!activeInstanceId || chatInput.trim().length === 0) {
      return;
    }
    const text = chatInput.trim();
    setChatInput("");
    await store.sendChat(activeInstanceId, text);
  };

  const handleLoadSettings = async () => {
    if (!activeInstanceId) {
      return;
    }
    const file = await store.readSettings(activeInstanceId, settingsKind);
    setLoadedFiles((prev) => ({
      ...prev,
      [`${activeInstanceId}:${settingsKind}`]: file,
    }));
    setSettingsContent(file.content);
    setSettingsStatus(`loaded: ${file.path}`);
  };

  const handleSaveSettings = async () => {
    if (!activeInstanceId) {
      return;
    }
    const loaded = loadedFiles[settingsKey];
    if (!loaded) {
      setSettingsStatus("load file first");
      return;
    }

    const result = await store.saveSettings({
      instanceId: activeInstanceId,
      kind: settingsKind,
      content: settingsContent,
      baseMtimeMs: loaded.mtimeMs,
    });

    if (!result.ok) {
      setLoadedFiles((prev) => ({
        ...prev,
        [settingsKey]: result.latest,
      }));
      setSettingsContent(result.latest.content);
      setSettingsStatus("conflict: reloaded latest");
      return;
    }

    setLoadedFiles((prev) => ({
      ...prev,
      [settingsKey]: result.file,
    }));
    setSettingsStatus(`saved: ${result.file.path}`);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Agenter WebUI</h1>
        <span className="status">{runtimeState.connected ? "WS connected" : "WS connecting"}</span>
      </header>

      <div className="layout">
        <InstancesPanel
          instances={runtimeState.instances}
          activeInstanceId={activeInstanceId}
          onSelect={setActiveInstanceId}
          onCreate={() => {
            void handleCreateInstance();
          }}
          onStart={() => {
            void handleStart();
          }}
          onStop={() => {
            void handleStop();
          }}
          onDelete={() => {
            void handleDelete();
          }}
        />

        <ChatPanel
          activeInstanceName={activeInstance?.name ?? null}
          messages={messages}
          input={chatInput}
          aiStatus={aiStatus}
          disabled={!activeInstanceId}
          onInputChange={setChatInput}
          onSend={() => {
            void handleSend();
          }}
        />

        <SettingsPanel
          kind={settingsKind}
          content={settingsContent}
          status={settingsStatus}
          disabled={!activeInstanceId}
          onKindChange={setSettingsKind}
          onContentChange={setSettingsContent}
          onLoad={() => {
            void handleLoadSettings();
          }}
          onSave={() => {
            void handleSaveSettings();
          }}
        />
      </div>
    </main>
  );
};

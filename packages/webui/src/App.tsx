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
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_42%)] text-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <h1 className="text-base font-semibold tracking-tight">Agenter WebUI</h1>
          <span className="text-xs text-slate-600">{runtimeState.connected ? "WS connected" : "WS connecting"}</span>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-4 lg:grid-cols-[300px_1fr_1fr] lg:grid-rows-[1fr_auto]">
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

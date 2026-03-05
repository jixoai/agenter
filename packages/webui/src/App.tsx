import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  FolderOpen,
  FolderTree,
  List,
  MessageCircle,
  PanelLeftOpen,
  Play,
  Plus,
  Settings2,
  Square,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import {
  createAgenterClient,
  createRuntimeStore,
  type RuntimeClientState,
  type SessionEntry,
} from "@agenter/client-sdk";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Tabs, type TabItem } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { ChatPanel } from "./features/chat/ChatPanel";
import { ProcessPanel } from "./features/process/ProcessPanel";
import { SessionsPanel } from "./features/sessions/SessionsPanel";
import { CreateSessionDialog } from "./features/sessions/CreateSessionDialog";
import { WorkspacePickerDialog } from "./features/sessions/WorkspacePickerDialog";
import { SettingsPanel, type SettingsLayerItem } from "./features/settings/SettingsPanel";
import { TasksPanel } from "./features/tasks/TasksPanel";
import { TerminalPanel } from "./features/terminal/TerminalPanel";
import { defaultWsUrl } from "./shared/ws-url";

const initialState: RuntimeClientState = {
  connected: false,
  lastEventId: 0,
  sessions: [],
  runtimes: {},
  activityBySession: {},
  terminalSnapshotsBySession: {},
  chatsBySession: {},
  tasksBySession: {},
  recentWorkspaces: [],
};

interface AppProps {
  wsUrl?: string;
}

type MainView = "chat" | "sessions" | "workspaces" | "settings";
type DetailsTab = "terminal" | "tasks" | "process";
type PickerTarget = "create" | "quickstart";

const DETAIL_TABS: TabItem[] = [
  { id: "terminal", label: "Terminal" },
  { id: "tasks", label: "Tasks" },
  { id: "process", label: "Process" },
];

const phaseToStatus = (session: SessionEntry | null, runtime?: RuntimeClientState["runtimes"][string]): string => {
  if (!session) {
    return "idle";
  }
  if (session.status === "error") {
    return "error";
  }
  if (session.status === "starting") {
    return "starting";
  }
  if (session.status === "stopped") {
    return "stopped";
  }
  if (!runtime) {
    return "syncing";
  }
  if (runtime.loopPhase === "waiting_processor_response") {
    return "waiting model";
  }
  if (runtime.loopPhase === "dispatching_tools") {
    return "tool calling";
  }
  if (runtime.loopPhase === "dispatching_terminal") {
    return "writing terminal";
  }
  if (runtime.loopPhase === "collecting_inputs" || runtime.loopPhase === "processing_messages") {
    return "syncing";
  }
  if (runtime.stage === "observe") {
    return "waiting terminal";
  }
  if (runtime.stage === "plan" || runtime.stage === "decide") {
    return "thinking";
  }
  if (runtime.stage === "act") {
    return "executing";
  }
  if (runtime.stage === "done") {
    return "done";
  }
  return "idle";
};

export const App = ({ wsUrl = defaultWsUrl() }: AppProps) => {
  const [runtimeState, setRuntimeState] = useState<RuntimeClientState>(initialState);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>("chat");
  const [detailsTab, setDetailsTab] = useState<DetailsTab>("terminal");
  const [desktopDetailsOpen, setDesktopDetailsOpen] = useState(true);
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [workspacePickerTarget, setWorkspacePickerTarget] = useState<PickerTarget>("create");
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [createWorkspacePath, setCreateWorkspacePath] = useState(".");
  const [quickstartWorkspacePath, setQuickstartWorkspacePath] = useState(".");
  const [quickstartInput, setQuickstartInput] = useState("");
  const [chatInput, setChatInput] = useState("");
  const [notice, setNotice] = useState("");

  const [settingsLayers, setSettingsLayers] = useState<SettingsLayerItem[]>([]);
  const [settingsEffective, setSettingsEffective] = useState("{}");
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [layerDraft, setLayerDraft] = useState("");
  const [layerMtimeMs, setLayerMtimeMs] = useState(0);
  const [settingsStatus, setSettingsStatus] = useState("idle");

  const pendingActiveSessionIdRef = useRef<string | null>(null);

  const client = useMemo(() => createAgenterClient({ wsUrl }), [wsUrl]);
  const store = useMemo(() => createRuntimeStore(client), [client]);

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      setRuntimeState({ ...state });
      if (state.recentWorkspaces.length > 0) {
        setQuickstartWorkspacePath((prev) => (prev === "." ? state.recentWorkspaces[0] : prev));
        setCreateWorkspacePath((prev) => (prev === "." ? state.recentWorkspaces[0] : prev));
      }
      setActiveSessionId((prev) => {
        if (prev && pendingActiveSessionIdRef.current === prev) {
          if (state.sessions.some((item) => item.id === prev)) {
            pendingActiveSessionIdRef.current = null;
            return prev;
          }
          return prev;
        }
        if (prev && state.sessions.some((item) => item.id === prev)) {
          return prev;
        }
        return null;
      });
    });

    void store.connect().catch((error) => {
      setNotice(error instanceof Error ? error.message : String(error));
    });

    return () => {
      unsubscribe();
      store.disconnect();
    };
  }, [store]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        setCreateDialogOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeSession = useMemo<SessionEntry | null>(() => {
    if (!activeSessionId) {
      return null;
    }
    return runtimeState.sessions.find((item) => item.id === activeSessionId) ?? null;
  }, [activeSessionId, runtimeState.sessions]);

  const visibleSessions = useMemo(() => {
    const ordered = [...runtimeState.sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return showAllSessions ? ordered : ordered.slice(0, 8);
  }, [runtimeState.sessions, showAllSessions]);

  const messages = activeSessionId ? runtimeState.chatsBySession[activeSessionId] ?? [] : [];
  const tasks = activeSessionId ? runtimeState.tasksBySession[activeSessionId] ?? [] : [];
  const activeRuntime = activeSessionId ? runtimeState.runtimes[activeSessionId] : undefined;
  const terminalSnapshots = activeSessionId ? runtimeState.terminalSnapshotsBySession[activeSessionId] : undefined;
  const aiStatus = phaseToStatus(activeSession, activeRuntime);
  const noTerminalHint =
    activeSessionId && activeRuntime && activeRuntime.terminals.length === 0
      ? "No terminal is configured or running for this session. Configure boot terminals in settings or start one manually."
      : null;
  const activeSessionLabel = activeSession?.name ?? (activeSessionId ? `Session · ${activeSessionId.slice(0, 8)}` : null);

  const setError = (error: unknown) => {
    setNotice(error instanceof Error ? error.message : String(error));
  };

  const refreshSettingsLayers = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      const data = await store.listSettingsLayers(activeSessionId);
      setSettingsLayers(data.layers);
      setSettingsEffective(data.effective.content);
      setSelectedLayerId((prev) => prev ?? data.layers[0]?.layerId ?? null);
      setSettingsStatus("layers refreshed");
    } catch (error) {
      setError(error);
    }
  };

  const loadSelectedLayer = async () => {
    if (!activeSessionId || !selectedLayerId) {
      return;
    }
    try {
      const file = await store.readSettingsLayer(activeSessionId, selectedLayerId);
      setLayerDraft(file.content);
      setLayerMtimeMs(file.mtimeMs);
      setSettingsStatus(`loaded: ${file.path}`);
    } catch (error) {
      setError(error);
    }
  };

  const saveSelectedLayer = async () => {
    if (!activeSessionId || !selectedLayerId) {
      return;
    }
    try {
      const result = await store.saveSettingsLayer({
        sessionId: activeSessionId,
        layerId: selectedLayerId,
        content: layerDraft,
        baseMtimeMs: layerMtimeMs,
      });
      if (!result.ok) {
        if (result.reason === "conflict") {
          setLayerDraft(result.latest.content);
          setLayerMtimeMs(result.latest.mtimeMs);
          setSettingsStatus("conflict: reloaded latest layer");
          return;
        }
        setSettingsStatus(result.message);
        return;
      }
      setLayerMtimeMs(result.file.mtimeMs);
      setSettingsEffective(result.effective.content);
      setSettingsStatus(`saved: ${result.file.path}`);
      await refreshSettingsLayers();
    } catch (error) {
      setError(error);
    }
  };

  useEffect(() => {
    if (mainView !== "settings" || !activeSessionId) {
      return;
    }
    void refreshSettingsLayers();
  }, [mainView, activeSessionId]);

  const handleCreateSession = async (input: { cwd: string; name?: string }) => {
    try {
      const session = await store.createSession({ cwd: input.cwd, name: input.name, autoStart: true });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setMainView("chat");
      await store.listRecentWorkspaces(8);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleStart = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      await store.startSession(activeSessionId);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleStop = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      await store.stopSession(activeSessionId);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleDelete = async () => {
    if (!activeSessionId) {
      return;
    }
    try {
      await store.deleteSession(activeSessionId);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleSend = async () => {
    if (!activeSessionId || chatInput.trim().length === 0) {
      return;
    }
    const text = chatInput.trim();
    setChatInput("");
    try {
      await store.sendChat(activeSessionId, text);
      setNotice("");
    } catch (error) {
      setChatInput(text);
      setError(error);
    }
  };

  const handleQuickstart = async () => {
    const text = quickstartInput.trim();
    if (text.length === 0) {
      return;
    }
    try {
      const session = await store.createSession({
        cwd: quickstartWorkspacePath,
        autoStart: true,
      });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setMainView("chat");
      await store.sendChat(session.id, text);
      setQuickstartInput("");
      await store.listRecentWorkspaces(8);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const handleEnterWorkspace = async () => {
    try {
      const session = await store.createSession({ cwd: quickstartWorkspacePath, autoStart: true });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setMainView("chat");
      await store.listRecentWorkspaces(8);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const openWorkspaceSession = async (workspacePath: string) => {
    try {
      const session = await store.createSession({ cwd: workspacePath, autoStart: true });
      pendingActiveSessionIdRef.current = session.id;
      setActiveSessionId(session.id);
      setMainView("chat");
      setQuickstartWorkspacePath(workspacePath);
      await store.listRecentWorkspaces(8);
      setNotice("");
    } catch (error) {
      setError(error);
    }
  };

  const renderChatDetails = () => {
    if (detailsTab === "terminal") {
      return <TerminalPanel runtime={activeRuntime} snapshots={terminalSnapshots} />;
    }
    if (detailsTab === "tasks") {
      return <TasksPanel tasks={tasks} compact />;
    }
    return <ProcessPanel messages={messages} />;
  };

  const renderMainView = () => {
    if (mainView === "sessions") {
      return (
        <SessionsPanel
          sessions={visibleSessions}
          activeSessionId={activeSessionId}
          showAll={showAllSessions}
          onToggleShowAll={() => setShowAllSessions((prev) => !prev)}
          onSelect={(sessionId) => {
            setActiveSessionId(sessionId);
            setMainView("chat");
          }}
          onCreate={() => setCreateDialogOpen(true)}
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
      );
    }

    if (mainView === "workspaces") {
      return (
        <section className="flex h-full min-h-0 flex-col rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Recent Workspaces</h2>
          <div className="min-h-0 space-y-2 overflow-auto">
            {runtimeState.recentWorkspaces.length === 0 ? <p className="text-xs text-slate-500">No workspace history yet.</p> : null}
            {runtimeState.recentWorkspaces.slice(-30).map((workspace) => (
              <button
                key={workspace}
                type="button"
                onClick={() => {
                  void openWorkspaceSession(workspace);
                }}
                className="w-full rounded-lg bg-slate-100 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-200"
                title={workspace}
              >
                <span className="line-clamp-2">{workspace}</span>
              </button>
            ))}
          </div>
        </section>
      );
    }

    if (mainView === "settings") {
      if (!activeSessionId) {
        return (
          <section className="flex h-full items-center justify-center rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">Select a session first to inspect settings layers.</p>
          </section>
        );
      }
      return (
        <SettingsPanel
          disabled={!activeSessionId}
          status={settingsStatus}
          effectiveContent={settingsEffective}
          layers={settingsLayers}
          selectedLayerId={selectedLayerId}
          layerContent={layerDraft}
          onSelectLayer={(layerId) => {
            setSelectedLayerId(layerId);
            setLayerDraft("");
            setLayerMtimeMs(0);
          }}
          onLayerContentChange={setLayerDraft}
          onRefreshLayers={() => {
            void refreshSettingsLayers();
          }}
          onLoadLayer={() => {
            void loadSelectedLayer();
          }}
          onSaveLayer={() => {
            void saveSelectedLayer();
          }}
        />
      );
    }

    if (!activeSessionId) {
      return (
        <div className="mx-auto flex h-full w-full max-w-3xl flex-col items-center justify-center gap-4">
          <section className="w-full rounded-2xl bg-white p-4 shadow-sm md:p-5">
            <h2 className="mb-2 text-base font-semibold">Quick Start</h2>
            <p className="mb-3 text-sm text-slate-600">Select a workspace and start a conversation.</p>
            <Textarea
              value={quickstartInput}
              onChange={(event) => setQuickstartInput(event.target.value)}
              className="min-h-[130px]"
              placeholder="Describe your task..."
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setWorkspacePickerTarget("quickstart");
                  setWorkspaceDialogOpen(true);
                }}
                title="Pick workspace"
              >
                Workspace
              </Button>
              <Button variant="outline" onClick={() => void handleEnterWorkspace()} title="Create session without first message">
                Enter Workspace
              </Button>
              <Button onClick={() => void handleQuickstart()} disabled={quickstartInput.trim().length === 0} title="Create session and send first message">
                Start
              </Button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <ChatPanel
        activeSessionName={activeSession?.name ?? activeSessionLabel}
        messages={messages}
        input={chatInput}
        aiStatus={aiStatus}
        noTerminalHint={noTerminalHint}
        disabled={!activeSessionId}
        onInputChange={setChatInput}
        onSend={() => void handleSend()}
      />
    );
  };

  const navItems: Array<{ key: MainView; label: string; icon: typeof MessageCircle }> = [
    { key: "chat", label: "Chat", icon: MessageCircle },
    { key: "sessions", label: "Sessions", icon: List },
    { key: "workspaces", label: "Workspaces", icon: FolderTree },
    { key: "settings", label: "Settings", icon: Settings2 },
  ];

  return (
    <main className="min-h-dvh bg-[radial-gradient(circle_at_top,#e2f2ff,#f8fafc_48%)] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setMobileSidebarOpen((prev) => !prev)} aria-label="Open navigation">
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
          <h1 className="text-sm font-semibold tracking-tight">Agenter</h1>
          <div className="ml-auto flex items-center gap-1">
            {mainView === "chat" && activeSession ? (
              <Button size="icon" variant="secondary" onClick={() => setMobileDetailsOpen(true)} title="Open tools" aria-label="Open tools">
                <Activity className="h-4 w-4" />
              </Button>
            ) : null}
            <Button size="icon" variant="secondary" onClick={() => setCreateDialogOpen(true)} title="New session" aria-label="New session">
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              onClick={() => {
                setWorkspacePickerTarget("quickstart");
                setWorkspaceDialogOpen(true);
              }}
              title="Select workspace"
              aria-label="Select workspace"
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => void handleStart()} disabled={!activeSessionId} title="Start session" aria-label="Start session">
              <Play className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="secondary" onClick={() => void handleStop()} disabled={!activeSessionId} title="Stop session" aria-label="Stop session">
              <Square className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="destructive" onClick={() => void handleDelete()} disabled={!activeSessionId} title="Delete session" aria-label="Delete session">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-slate-200 bg-white/90 px-3 py-2">
        <div className="mx-auto flex items-center gap-2">
          {notice ? <Badge variant="destructive">{notice}</Badge> : null}
          <Badge variant="secondary">{runtimeState.connected ? "Connected" : "Reconnecting"}</Badge>
          <Badge variant={aiStatus === "error" ? "destructive" : aiStatus === "idle" ? "secondary" : "warning"}>AI: {aiStatus}</Badge>
          {activeSessionLabel ? <Badge variant="secondary">{activeSessionLabel}</Badge> : <Badge variant="warning">No session</Badge>}
        </div>
      </div>

      <div className="mx-auto grid grid-cols-1 md:grid-cols-[56px_1fr]">
        <aside className="hidden h-[calc(100dvh-92px)] border-r border-slate-200 bg-white md:flex md:flex-col md:items-center md:gap-1 md:p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.key}
                size="icon"
                variant={mainView === item.key ? "default" : "ghost"}
                onClick={() => setMainView(item.key)}
                title={item.label}
                aria-label={item.label}
              >
                <Icon className="h-4 w-4" />
              </Button>
            );
          })}
        </aside>

        <section className="h-[calc(100dvh-92px)] min-h-0 p-3 md:p-4">
          {mainView === "chat" && activeSessionId ? (
            <div className={`grid h-full min-h-0 grid-cols-1 gap-3 ${desktopDetailsOpen ? "xl:grid-cols-[1fr_380px]" : "xl:grid-cols-1"}`}>
              {renderMainView()}
              {desktopDetailsOpen ? (
                <aside className="hidden min-h-0 rounded-2xl bg-white p-3 shadow-sm xl:flex xl:flex-col xl:gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">Tools</h2>
                    <Button size="icon" variant="ghost" onClick={() => setDesktopDetailsOpen(false)} title="Hide tools" aria-label="Hide tools">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Tabs items={DETAIL_TABS} value={detailsTab} onValueChange={(value) => setDetailsTab(value as DetailsTab)} />
                  <div className="min-h-0 flex-1 overflow-hidden">{renderChatDetails()}</div>
                </aside>
              ) : null}
            </div>
          ) : (
            renderMainView()
          )}
        </section>
      </div>

      {mainView === "chat" && activeSessionId && !desktopDetailsOpen ? (
        <div className="fixed bottom-4 right-4 hidden xl:block">
          <Button size="icon" onClick={() => setDesktopDetailsOpen(true)} title="Show tools" aria-label="Show tools">
            <TerminalSquare className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      {mobileSidebarOpen ? (
        <div className="fixed inset-0 z-30 bg-slate-900/50 md:hidden" onClick={() => setMobileSidebarOpen(false)}>
          <aside className="h-full w-[88vw] max-w-[320px] bg-white p-3" onClick={(event) => event.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold">Navigation</p>
              <Button size="icon" variant="ghost" onClick={() => setMobileSidebarOpen(false)} aria-label="Close navigation">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setMainView(item.key);
                      setMobileSidebarOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm ${mainView === item.key ? "bg-teal-100 text-teal-900" : "bg-slate-100 text-slate-700"}`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      ) : null}

      {mobileDetailsOpen && mainView === "chat" && activeSessionId ? (
        <div className="fixed inset-0 z-40 bg-white xl:hidden">
          <div className="flex h-full flex-col">
            <header className="flex items-center gap-2 border-b border-slate-200 p-3">
              <Button size="icon" variant="ghost" onClick={() => setMobileDetailsOpen(false)} aria-label="Back to chat" title="Back to chat">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-sm font-semibold text-slate-900">Tools</h2>
            </header>
            <div className="border-b border-slate-200 p-3">
              <Tabs items={DETAIL_TABS} value={detailsTab} onValueChange={(value) => setDetailsTab(value as DetailsTab)} className="w-full" />
            </div>
            <div className="min-h-0 flex-1 overflow-hidden p-3">{renderChatDetails()}</div>
          </div>
        </div>
      ) : null}

      <CreateSessionDialog
        open={createDialogOpen}
        cwd={createWorkspacePath}
        onClose={() => setCreateDialogOpen(false)}
        onOpenWorkspacePicker={() => {
          setWorkspacePickerTarget("create");
          setWorkspaceDialogOpen(true);
        }}
        onCreate={async ({ cwd, name }) => {
          await handleCreateSession({ cwd, name });
        }}
      />

      <WorkspacePickerDialog
        open={workspaceDialogOpen}
        initialPath={workspacePickerTarget === "create" ? createWorkspacePath : quickstartWorkspacePath}
        recentWorkspaces={runtimeState.recentWorkspaces}
        onClose={() => setWorkspaceDialogOpen(false)}
        onPick={(path) => {
          if (workspacePickerTarget === "create") {
            setCreateWorkspacePath(path);
          } else {
            setQuickstartWorkspacePath(path);
          }
        }}
        listDirectories={(input) => store.listDirectories(input)}
        validateDirectory={(path) => store.validateDirectory(path)}
      />
    </main>
  );
};

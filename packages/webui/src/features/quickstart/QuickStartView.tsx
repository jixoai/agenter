import type { DraftResolutionOutput, WorkspaceSessionEntry } from "@agenter/client-sdk";
import { FolderSearch, Pencil, PlayCircle, Plus, Settings2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { HelpHint } from "../../components/ui/help-hint";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Skeleton } from "../../components/ui/skeleton";
import { AIInput, type AIInputSuggestion, type AIInputSubmitPayload } from "../chat/AIInput";
import { SessionItem } from "../workspaces/SessionItem";
import { QuickstartRoomConfigDialog } from "./quickstart-room-config-dialog";
import { QuickstartTerminalConfigDialog } from "./quickstart-terminal-config-dialog";
import {
  DEFAULT_QUICKSTART_BOOTSTRAP_CONFIG,
  type QuickstartBootstrapConfig,
  type QuickstartTerminalConfig,
} from "./quickstart-bootstrap-types";

interface QuickStartViewProps {
  workspacePath: string;
  draftResolution: DraftResolutionOutput | null;
  recentSessions: WorkspaceSessionEntry[];
  loadingDraft: boolean;
  starting: boolean;
  bootstrapConfig?: QuickstartBootstrapConfig;
  bootstrapLoading?: boolean;
  onOpenWorkspacePicker: () => void;
  onEnterWorkspace: () => void;
  onSaveBootstrapConfig?: (config: QuickstartBootstrapConfig) => Promise<void>;
  onSubmit: (payload: AIInputSubmitPayload) => Promise<void>;
  onSearchPaths: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
  onResumeSession: (sessionId: string) => void;
}

export const QuickStartView = ({
  workspacePath,
  draftResolution,
  recentSessions,
  loadingDraft,
  starting,
  bootstrapConfig = DEFAULT_QUICKSTART_BOOTSTRAP_CONFIG,
  bootstrapLoading = false,
  onOpenWorkspacePicker,
  onEnterWorkspace,
  onSaveBootstrapConfig,
  onSubmit,
  onSearchPaths,
  onResumeSession,
}: QuickStartViewProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false);
  const [editingTerminalId, setEditingTerminalId] = useState<string | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const workspaceScoped = workspacePath.trim().length > 0 && workspacePath !== ".";
  const workspaceReady = workspacePath.trim().length > 0 && workspacePath !== "." && draftResolution !== null;
  const providerLabel = draftResolution
    ? [
        draftResolution.provider.vendor ?? draftResolution.provider.providerId,
        draftResolution.provider.apiStandard,
        draftResolution.provider.model,
      ]
        .filter((part) => typeof part === "string" && part.length > 0)
        .join(" · ")
    : loadingDraft
      ? "Resolving provider..."
      : "Provider unavailable";

  const imageInputCompatible = draftResolution?.modelCapabilities.imageInput ?? false;
  const activeTerminals = bootstrapConfig.terminals;
  const editingTerminal = useMemo(
    () => activeTerminals.find((terminal) => terminal.terminalId === editingTerminalId) ?? null,
    [activeTerminals, editingTerminalId],
  );
  const canEditBootstrap = Boolean(onSaveBootstrapConfig) && workspaceScoped;
  const inputPlaceholder = !workspaceReady
    ? "Choose a workspace before starting a session..."
    : imageInputCompatible
      ? "Describe the task, use @ to reference files, or paste images..."
      : "Describe the task and use @ to reference files...";
  const recentLoadingShell = (
    <div className="space-y-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-3 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-5/6" />
        </div>
      ))}
    </div>
  );

  const persistBootstrapConfig = async (next: QuickstartBootstrapConfig) => {
    if (!onSaveBootstrapConfig) {
      return;
    }
    setConfigSaving(true);
    setConfigError(null);
    try {
      await onSaveBootstrapConfig(next);
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : String(error));
      throw error;
    } finally {
      setConfigSaving(false);
    }
  };

  const handleSaveTerminal = async (terminal: QuickstartTerminalConfig) => {
    const nextTerminals = activeTerminals.some((item) => item.terminalId === terminal.terminalId)
      ? activeTerminals.map((item) => (item.terminalId === terminal.terminalId ? terminal : item))
      : [...activeTerminals, terminal];
    await persistBootstrapConfig({
      ...bootstrapConfig,
      terminals: nextTerminals,
    });
  };

  const handleDeleteTerminal = async (terminalId: string) => {
    if (!onSaveBootstrapConfig) {
      return;
    }
    try {
      await persistBootstrapConfig({
        ...bootstrapConfig,
        terminals: activeTerminals.filter((terminal) => terminal.terminalId !== terminalId),
      });
    } catch {
      // persistBootstrapConfig already publishes UI error state.
    }
  };

  return (
    <section className="grid h-full grid-rows-[minmax(0,1fr)]">
      <ScrollViewport data-testid="quickstart-scroll-viewport" className="h-full pr-1">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4 pb-2">
          <section className="rounded-[1.5rem] bg-white/96 p-4 shadow-sm ring-1 ring-slate-200/80 md:p-5">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canEditBootstrap || configSaving || bootstrapLoading}
                    onClick={() => setRoomDialogOpen(true)}
                    title="Edit chat-main room metadata"
                  >
                    <ButtonLeadingVisual>
                      <Settings2 className="h-4 w-4" />
                    </ButtonLeadingVisual>
                    <ButtonLabel>Room config</ButtonLabel>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canEditBootstrap || configSaving || bootstrapLoading}
                    onClick={() => {
                      setEditingTerminalId(null);
                      setTerminalDialogOpen(true);
                    }}
                    title="Add quickstart boot terminal"
                  >
                    <ButtonLeadingVisual>
                      <Plus className="h-4 w-4" />
                    </ButtonLeadingVisual>
                    <ButtonLabel>Add terminal</ButtonLabel>
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" onClick={onOpenWorkspacePicker} title="Choose workspace">
                    <ButtonLeadingVisual>
                      <FolderSearch className="h-4 w-4" />
                    </ButtonLeadingVisual>
                    <ButtonLabel>Change</ButtonLabel>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={onEnterWorkspace}
                    disabled={starting || !workspaceReady}
                    title="Enter workspace without a first message"
                  >
                    <ButtonLeadingVisual>
                      <PlayCircle className="h-4 w-4" />
                    </ButtonLeadingVisual>
                    <ButtonLabel>Enter</ButtonLabel>
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h2 className="typo-title-2 text-slate-900">Quick Start</h2>
                  <HelpHint
                    helpId="quickstart:overview"
                    textContext="Choose a workspace, then start a new session with one prompt."
                    content="Choose a workspace, then start a new session with one prompt."
                  />
                </div>
              </div>

              {activeTerminals.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">Boot terminals</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeTerminals.map((terminal) => (
                      <div
                        key={terminal.terminalId}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-white px-2 py-1"
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 text-xs text-slate-800"
                          disabled={!canEditBootstrap || configSaving}
                          onClick={() => {
                            setEditingTerminalId(terminal.terminalId);
                            setTerminalDialogOpen(true);
                          }}
                        >
                          <span className="font-medium">{terminal.terminalId}</span>
                          <span className="text-slate-500">{terminal.focus ? "focus" : "idle"}</span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                          aria-label={`Edit terminal ${terminal.terminalId}`}
                          disabled={!canEditBootstrap || configSaving}
                          onClick={() => {
                            setEditingTerminalId(terminal.terminalId);
                            setTerminalDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-50"
                          aria-label={`Delete terminal ${terminal.terminalId}`}
                          disabled={!canEditBootstrap || configSaving}
                          onClick={() => {
                            void handleDeleteTerminal(terminal.terminalId);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {bootstrapLoading || configSaving ? (
                <p className="text-xs text-slate-500">{bootstrapLoading ? "Loading quick start config..." : "Saving config..."}</p>
              ) : null}
              {configError ? <p className="text-xs text-rose-700">{configError}</p> : null}
            </div>

            <div className="mt-4">
              <AIInput
                workspacePath={workspacePath}
                disabled={starting || loadingDraft || !workspaceReady}
                imageEnabled
                imageCompatible={imageInputCompatible}
                submitLabel="Start"
                submitTitle="Create session and send the first message"
                placeholder={inputPlaceholder}
                onSubmit={onSubmit}
                onSearchPaths={onSearchPaths}
              />
            </div>

            <div className="mt-3 space-y-2 rounded-2xl bg-slate-50/85 px-3 py-3 ring-1 ring-slate-200/70">
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Workspace</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {workspacePath.split(/[\\/]+/).filter(Boolean).at(-1) ?? workspacePath}
                </p>
                <p className="mt-1 hidden break-all text-xs text-slate-500 sm:block">{workspacePath}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Badge variant="secondary">{providerLabel}</Badge>
                <Badge variant={imageInputCompatible ? "success" : "secondary"}>
                  {imageInputCompatible ? "Image input ready" : "Image upload ready"}
                </Badge>
              </div>
            </div>
          </section>

          <section className="rounded-[1.5rem] bg-white/94 p-4 shadow-sm ring-1 ring-slate-200/80">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="typo-title-3 text-slate-900">Recent Sessions</h3>
                <p className="text-xs text-slate-500">Up to the latest three sessions from this workspace.</p>
              </div>
              <Badge variant="secondary">{recentSessions.length}</Badge>
            </div>

            <AsyncSurface
              state={resolveAsyncSurfaceState({ loading: loadingDraft, hasData: recentSessions.length > 0 })}
              loadingOverlayLabel="Refreshing recent sessions..."
              skeleton={recentLoadingShell}
              empty={
                <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No recent sessions for this workspace yet.
                </p>
              }
            >
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <SessionItem
                    key={session.sessionId}
                    session={session}
                    selected={selectedSessionId === session.sessionId}
                    mode="quickstart"
                    onSelect={setSelectedSessionId}
                    onActivate={onResumeSession}
                  />
                ))}
              </div>
            </AsyncSurface>
          </section>
        </div>
      </ScrollViewport>
      <QuickstartRoomConfigDialog
        open={roomDialogOpen}
        value={bootstrapConfig.room}
        ownerHint={draftResolution?.avatar ?? "agenter"}
        onClose={() => setRoomDialogOpen(false)}
        onSave={async (room) => {
          await persistBootstrapConfig({
            ...bootstrapConfig,
            room,
          });
        }}
      />
      <QuickstartTerminalConfigDialog
        open={terminalDialogOpen}
        workspacePath={workspacePath}
        value={editingTerminal}
        onClose={() => {
          setTerminalDialogOpen(false);
          setEditingTerminalId(null);
        }}
        onSave={async (terminal) => {
          await handleSaveTerminal(terminal);
        }}
      />
    </section>
  );
};

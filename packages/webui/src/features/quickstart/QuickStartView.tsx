import type { DraftResolutionOutput, WorkspaceSessionEntry } from "@agenter/client-sdk";
import { FolderSearch, PlayCircle } from "lucide-react";
import { useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Skeleton } from "../../components/ui/skeleton";
import { AIInput, type AIInputSuggestion, type AIInputSubmitPayload } from "../chat/AIInput";
import { SessionItem } from "../workspaces/SessionItem";

interface QuickStartViewProps {
  workspacePath: string;
  draftResolution: DraftResolutionOutput | null;
  recentSessions: WorkspaceSessionEntry[];
  loadingDraft: boolean;
  starting: boolean;
  onOpenWorkspacePicker: () => void;
  onEnterWorkspace: () => void;
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
  onOpenWorkspacePicker,
  onEnterWorkspace,
  onSubmit,
  onSearchPaths,
  onResumeSession,
}: QuickStartViewProps) => {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
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
  const inputPlaceholder = imageInputCompatible
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

  return (
    <section className="grid h-full grid-rows-[minmax(0,1fr)]">
      <ScrollViewport data-testid="quickstart-scroll-viewport" className="h-full pr-1">
        <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col gap-4 pb-2">
          <section className="rounded-[1.5rem] bg-white/96 p-4 shadow-sm ring-1 ring-slate-200/80 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <h2 className="typo-title-2 text-slate-900">Quick Start</h2>
                <p className="text-sm text-slate-600">Choose a workspace, then start a new session with one prompt.</p>
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
                  disabled={starting}
                  title="Enter workspace without a first message"
                >
                  <ButtonLeadingVisual>
                    <PlayCircle className="h-4 w-4" />
                  </ButtonLeadingVisual>
                  <ButtonLabel>Enter</ButtonLabel>
                </Button>
              </div>
            </div>

            <div className="mt-4">
              <AIInput
                workspacePath={workspacePath}
                disabled={starting || loadingDraft}
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
    </section>
  );
};

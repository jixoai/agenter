import type { DraftResolutionOutput, WorkspaceSessionEntry } from "@agenter/client-sdk";
import { FolderSearch, PlayCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
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
    ? `${draftResolution.provider.providerId} · ${draftResolution.provider.model}`
    : loadingDraft
      ? "Resolving provider..."
      : "Provider unavailable";

  const imageInput = draftResolution?.modelCapabilities.imageInput ?? false;
  const inputPlaceholder = imageInput
    ? "Describe the task, use @ to reference files, or paste images..."
    : "Describe the task and use @ to reference files...";

  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col gap-4">
      <section className="rounded-[1.5rem] bg-white/96 p-4 shadow-sm ring-1 ring-slate-200/80 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="typo-title-2 text-slate-900">Quick Start</h2>
              <Badge variant="secondary">{providerLabel}</Badge>
              <Badge variant={imageInput ? "success" : "secondary"}>{imageInput ? "Images on" : "Images off"}</Badge>
            </div>
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

        <div className="mt-3 rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200/70">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Workspace</p>
          <p className="mt-1 text-sm break-all text-slate-900">{workspacePath}</p>
        </div>

        <div className="mt-4">
          <AIInput
            workspacePath={workspacePath}
            disabled={starting || loadingDraft}
            imageEnabled={imageInput}
            submitLabel="Start"
            submitTitle="Create session and send the first message"
            placeholder={inputPlaceholder}
            onSubmit={onSubmit}
            onSearchPaths={onSearchPaths}
          />
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

        {recentSessions.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">No recent sessions for this workspace yet.</p>
        ) : (
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
        )}
      </section>
    </div>
  );
};

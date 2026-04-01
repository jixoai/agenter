import type {
  GlobalTerminalApprovalRequest,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  GlobalTerminalGrantIssueOutput,
  TerminalActivityItem,
} from "@agenter/client-sdk";
import { ListRestart, Maximize2, Minimize2, Plus, Shield, TerminalSquare, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { NoticeBanner } from "../../components/ui/notice-banner";
import { ClipSurface, ViewportMask } from "../../components/ui/overflow-surface";
import { Skeleton } from "../../components/ui/skeleton";
import { surfaceToneClassName } from "../../components/ui/surface";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import type { ActorTokenOption } from "../collaboration/ActorTokenSelect";
import { cn } from "../../lib/utils";
import { TerminalActionsUsersPanel } from "./TerminalActionsUsersPanel";
import { TerminalActorGroup, type TerminalActorMeta } from "./TerminalActorGroup";
import { TerminalApprovalRequestsDialog } from "./TerminalApprovalRequestsDialog";
import { TerminalGrantManagerDialog, type TerminalActorOption } from "./TerminalGrantManagerDialog";
import type { TerminalUserEntry } from "./TerminalUsersPanel";
import { TerminalViewHost } from "./TerminalViewHost";
import { TerminalCreateDialog } from "./terminal-create-dialog";

type ViewportMode = "fit" | "cover";

interface GlobalTerminalWorkbenchProps {
  terminals: GlobalTerminalEntry[];
  selectedTerminalId: string | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  viewportMode: ViewportMode;
  actorOptions: TerminalActorOption[];
  callerOptions: ActorTokenOption[];
  selectedCallerToken: string | null;
  resolveActorMeta: (actorId: string) => TerminalActorMeta | null;
  activity: {
    terminalId: string | null;
    items: TerminalActivityItem[];
    hasMore: boolean;
    loading: boolean;
    loadingMore: boolean;
  };
  grants: {
    terminalId: string | null;
    items: GlobalTerminalGrantEntry[];
    loading: boolean;
    error: string | null;
  };
  users: TerminalUserEntry[];
  onRefresh: () => Promise<void> | void;
  onSelectCallerToken: (accessToken: string) => void;
  onSelectTerminal: (terminalId: string) => void;
  onSetViewportMode: (mode: ViewportMode) => void;
  onCreateTerminal: (input: {
    terminalId?: string;
    processKind?: string;
    command?: string[];
    cwd?: string;
    profile?: {
      command?: string[];
      cwd?: string;
      cols?: number;
      rows?: number;
      gitLog?: false | "none" | "normal" | "verbose";
      logStyle?: "plain" | "rich";
      icon?: string;
      title?: string;
      shortcuts?: Record<string, string>;
    };
    focus?: boolean;
  }) => Promise<{ ok: boolean; message: string; terminal?: GlobalTerminalEntry }>;
  onDeleteTerminal: (input: { terminalId: string }) => Promise<{ ok: boolean; message: string }>;
  onListGrants: (terminalId: string) => Promise<GlobalTerminalGrantEntry[]>;
  onIssueGrant: (input: {
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: TerminalActorOption["actorId"];
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }) => Promise<GlobalTerminalGrantIssueOutput["grant"]>;
  onRevokeGrant: (input: { terminalId: string; grantId: string }) => Promise<{ ok: boolean }>;
  onListApprovalRequests: (input: {
    terminalId: string;
    statuses?: GlobalTerminalApprovalRequest["status"][];
  }) => Promise<GlobalTerminalApprovalRequest[]>;
  onApproveRequest: (input: { terminalId: string; requestId: string; durationMs: number }) => Promise<unknown>;
  onDenyRequest: (input: { terminalId: string; requestId: string }) => Promise<unknown>;
  onLoadMoreActivity: () => Promise<void> | void;
  onSetUserFocus: (input: { actorId: string; accessToken: string; focused: boolean }) => Promise<void> | void;
  onReadTerminal: (input: {
    accessToken?: string;
    mode?: "auto" | "diff" | "snapshot";
    remark?: boolean;
  }) => Promise<void> | void;
  onWriteTerminal: (input: {
    accessToken?: string;
    text: string;
    submit?: boolean;
    submitKey?: "enter" | "linefeed";
  }) => Promise<void> | void;
}

const LoadingShell = () => (
  <div className="space-y-3">
    <Skeleton className="h-9 w-full rounded-xl" />
    <Skeleton className="h-14 w-full rounded-2xl" />
    <div className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.9fr)]">
      <Skeleton className="h-[26rem] rounded-3xl" />
      <Skeleton className="h-[26rem] rounded-3xl" />
    </div>
  </div>
);

const isAdminSeat = (terminal: GlobalTerminalEntry | null): boolean => {
  if (!terminal?.access) {
    return false;
  }
  return terminal.access.role === "admin" || terminal.access.currentAdmin;
};

export const GlobalTerminalWorkbench = ({
  terminals,
  selectedTerminalId,
  loading,
  refreshing,
  error,
  viewportMode,
  actorOptions,
  callerOptions,
  selectedCallerToken,
  resolveActorMeta,
  activity,
  grants,
  users,
  onRefresh,
  onSelectCallerToken,
  onSelectTerminal,
  onSetViewportMode,
  onCreateTerminal,
  onDeleteTerminal,
  onListGrants,
  onIssueGrant,
  onRevokeGrant,
  onListApprovalRequests,
  onApproveRequest,
  onDenyRequest,
  onLoadMoreActivity,
  onSetUserFocus,
  onReadTerminal,
  onWriteTerminal,
}: GlobalTerminalWorkbenchProps) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const selectedTerminal = useMemo(
    () => terminals.find((terminal) => terminal.terminalId === selectedTerminalId) ?? terminals[0] ?? null,
    [selectedTerminalId, terminals],
  );
  const tabItems = useMemo<TabItem[]>(
    () =>
      terminals.map((terminal) => ({
        id: terminal.terminalId,
        label: terminal.title ?? terminal.terminalId,
        badgeCount: terminal.pendingRequestCount,
      })),
    [terminals],
  );
  const shortcutCount = Object.keys(selectedTerminal?.shortcuts ?? {}).length;
  const canAdminister = isAdminSeat(selectedTerminal);
  const surfaceState = resolveAsyncSurfaceState({
    loading,
    hasData: terminals.length > 0,
  });

  return (
    <>
      <section className={cn(surfaceToneClassName("panel"), "grid h-full grid-rows-[auto_minmax(0,1fr)] gap-3 p-3")}>
        <div className="space-y-3">
          {error ? <NoticeBanner tone="destructive">{error}</NoticeBanner> : null}

          <Tabs
            items={tabItems}
            value={selectedTerminal?.terminalId ?? ""}
            onValueChange={onSelectTerminal}
            ariaLabel="Global terminals"
            trailing={
              <>
                <Button type="button" size="sm" variant="outline" onClick={() => void onRefresh()} disabled={refreshing}>
                  <ButtonLeadingVisual>
                    <ListRestart className="h-3.5 w-3.5" />
                  </ButtonLeadingVisual>
                  <ButtonLabel>{refreshing ? "Refreshing..." : "Refresh"}</ButtonLabel>
                </Button>
                <Button type="button" size="sm" onClick={() => setCreateDialogOpen(true)}>
                  <ButtonLeadingVisual>
                    <Plus className="h-3.5 w-3.5" />
                  </ButtonLeadingVisual>
                  <ButtonLabel>Create terminal</ButtonLabel>
                </Button>
              </>
            }
          />

          {selectedTerminal ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/90 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onSetViewportMode(viewportMode === "fit" ? "cover" : "fit")}
                >
                  <ButtonLeadingVisual>
                    {viewportMode === "fit" ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
                  </ButtonLeadingVisual>
                  <ButtonLabel>{viewportMode === "fit" ? "Cover viewport" : "Fit viewport"}</ButtonLabel>
                </Button>
                <Badge variant={selectedTerminal.status === "BUSY" ? "warning" : "secondary"}>{selectedTerminal.status}</Badge>
                {selectedTerminal.rendererEngine ? <Badge variant="secondary">{selectedTerminal.rendererEngine}</Badge> : null}
                {shortcutCount > 0 ? <Badge variant="secondary">{shortcutCount} shortcuts</Badge> : null}
                {selectedTerminal.access ? (
                  <Badge variant={selectedTerminal.access.role === "readonly" ? "destructive" : "success"}>
                    {selectedTerminal.access.currentAdmin ? "current admin" : selectedTerminal.access.role}
                  </Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setGrantDialogOpen(true)}
                  disabled={!canAdminister}
                >
                  <ButtonLeadingVisual>
                    <Shield className="h-3.5 w-3.5" />
                  </ButtonLeadingVisual>
                  <ButtonLabel>Access</ButtonLabel>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setApprovalDialogOpen(true)}
                  disabled={!canAdminister}
                >
                  <ButtonLeadingVisual>
                    <TerminalSquare className="h-3.5 w-3.5" />
                  </ButtonLeadingVisual>
                  <ButtonLabel>{`Approvals ${selectedTerminal.pendingRequestCount ?? 0}`}</ButtonLabel>
                </Button>
                <TerminalActorGroup actors={selectedTerminal.actors ?? []} resolveActorMeta={resolveActorMeta} />
              </div>
            </div>
          ) : null}
        </div>

        <AsyncSurface
          state={surfaceState}
          loadingOverlayLabel="Refreshing terminals..."
          skeleton={<LoadingShell />}
          empty={
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
              <TerminalSquare className="h-8 w-8 text-slate-400" />
              <div className="space-y-1">
                <p className="text-base font-medium text-slate-900">No global terminals yet</p>
                <p className="max-w-md text-sm text-slate-500">
                  Create a terminal here, then grant seats to the AvatarSessions that should watch or operate it.
                </p>
              </div>
              <Button type="button" onClick={() => setCreateDialogOpen(true)}>
                <ButtonLeadingVisual>
                  <Plus className="h-3.5 w-3.5" />
                </ButtonLeadingVisual>
                <ButtonLabel>Create terminal</ButtonLabel>
              </Button>
            </div>
          }
          className="h-full"
        >
          {selectedTerminal ? (
            <div className="grid h-full gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.9fr)]">
              <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 rounded-3xl border border-slate-200 bg-white/95 p-3 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="typo-title-3 text-slate-900">{selectedTerminal.title ?? selectedTerminal.terminalId}</h2>
                      <Badge variant="secondary">{selectedTerminal.processKind}</Badge>
                      {selectedTerminal.currentAdminId ? <Badge variant="warning">{selectedTerminal.currentAdminId}</Badge> : null}
                    </div>
                    <p className="break-all text-sm text-slate-500">{selectedTerminal.cwd}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canAdminister || actionBusy}
                    onClick={() => setDeleteDialogOpen(true)}
                    className="border-rose-200 text-rose-900"
                  >
                    <ButtonLeadingVisual>
                      <Trash2 className="h-3.5 w-3.5" />
                    </ButtonLeadingVisual>
                    <ButtonLabel>Delete</ButtonLabel>
                  </Button>
                </div>

                <ViewportMask className="h-full rounded-[1.75rem]">
                  <ClipSurface className="h-full rounded-[1.75rem] border border-slate-200 bg-slate-950">
                    <TerminalViewHost
                      terminalId={selectedTerminal.terminalId}
                      terminalTitle={selectedTerminal.title}
                      cwd={selectedTerminal.cwd}
                      status={selectedTerminal.status}
                      viewportMode={viewportMode}
                      transportUrl={selectedTerminal.transportUrl}
                      className="h-full"
                      testId="global-terminal-view"
                    />
                  </ClipSurface>
                </ViewportMask>
              </section>

              <TerminalActionsUsersPanel
                terminalId={selectedTerminal.terminalId}
                items={activity.terminalId === selectedTerminal.terminalId ? activity.items : []}
                users={users}
                callerOptions={callerOptions}
                selectedCallerToken={selectedCallerToken}
                activityHasMore={activity.terminalId === selectedTerminal.terminalId ? activity.hasMore : false}
                activityLoading={activity.terminalId === selectedTerminal.terminalId ? activity.loading : false}
                activityLoadingOlder={activity.terminalId === selectedTerminal.terminalId ? activity.loadingMore : false}
                usersLoading={grants.loading}
                error={grants.error}
                onSelectCallerToken={onSelectCallerToken}
                onLoadMore={() => void onLoadMoreActivity()}
                onSetUserFocus={onSetUserFocus}
                onRead={(input) => onReadTerminal(input)}
                onWrite={(input) => onWriteTerminal(input)}
                resolveActorMeta={(actorId) => (actorId ? resolveActorMeta(actorId) : null)}
              />
            </div>
          ) : null}
        </AsyncSurface>
      </section>

      <TerminalCreateDialog
        open={createDialogOpen}
        defaultCwd={selectedTerminal?.cwd ?? "."}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={async (input) => {
          await onCreateTerminal(input);
          setCreateDialogOpen(false);
          await onRefresh();
        }}
      />

      <Dialog
        open={deleteDialogOpen}
        title={selectedTerminal ? `Delete ${selectedTerminal.title ?? selectedTerminal.terminalId}` : "Delete terminal"}
        description="Deleting a terminal stops the process and removes it from the global terminal catalog."
        onClose={() => {
          if (actionBusy) {
            return;
          }
          setDeleteDialogOpen(false);
        }}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDeleteDialogOpen(false)} disabled={actionBusy}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={actionBusy || !selectedTerminal}
              onClick={() => {
                if (!selectedTerminal) {
                  return;
                }
                setActionBusy(true);
                void onDeleteTerminal({ terminalId: selectedTerminal.terminalId })
                  .then(async () => {
                    setDeleteDialogOpen(false);
                    await onRefresh();
                  })
                  .finally(() => {
                    setActionBusy(false);
                  });
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-600">
          The terminal history remains in the durable terminal authority, but this live terminal instance will stop and disappear from the active workbench.
        </p>
      </Dialog>

      <TerminalGrantManagerDialog
        open={grantDialogOpen}
        terminal={selectedTerminal}
        actorOptions={actorOptions}
        onClose={() => setGrantDialogOpen(false)}
        onListGrants={onListGrants}
        onIssueGrant={onIssueGrant}
        onRevokeGrant={onRevokeGrant}
        onChanged={onRefresh}
      />

      <TerminalApprovalRequestsDialog
        open={approvalDialogOpen}
        terminal={selectedTerminal}
        onClose={() => setApprovalDialogOpen(false)}
        onListApprovalRequests={onListApprovalRequests}
        onApproveRequest={onApproveRequest}
        onDenyRequest={onDenyRequest}
        onChanged={onRefresh}
      />
    </>
  );
};

import type { WorkspaceEntry, WorkspaceWelcomeSnapshotOutput } from "@agenter/client-sdk";
import { Bot, MessagesSquare, Play, RefreshCcw, TerminalSquare } from "lucide-react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { CardButton } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { ScrollViewport } from "../../components/ui/overflow-surface";
import { Select } from "../../components/ui/select";
import { surfaceToneClassName } from "../../components/ui/surface";
import { cn } from "../../lib/utils";

interface WorkspaceWelcomeSurfaceProps {
  loading: boolean;
  busy: boolean;
  workspaces: WorkspaceEntry[];
  workspacePath: string;
  avatar: string;
  snapshot: WorkspaceWelcomeSnapshotOutput | null;
  selectedRoomIds: string[];
  selectedTerminalIds: string[];
  roomRoles: Record<string, "admin" | "member" | "readonly">;
  terminalRoles: Record<string, "admin" | "writer" | "requester" | "readonly">;
  onWorkspacePathChange: (workspacePath: string) => void;
  onAvatarChange: (avatar: string) => void;
  onToggleRoom: (chatId: string) => void;
  onToggleTerminal: (terminalId: string) => void;
  onRoomRoleChange: (chatId: string, role: "admin" | "member" | "readonly") => void;
  onTerminalRoleChange: (terminalId: string, role: "admin" | "writer" | "requester" | "readonly") => void;
  onRefresh: () => void;
  onOpenChats: () => void;
  onOpenTerminals: () => void;
  onStart: () => void;
}

const accessTone = (state: "joined" | "available" | "credential-invalid") => {
  if (state === "joined") {
    return "success";
  }
  if (state === "credential-invalid") {
    return "destructive";
  }
  return "secondary";
};

const describeWorkspace = (workspace: WorkspaceEntry): string => {
  if (workspace.path === "~/") {
    return "~/";
  }
  return workspace.path;
};

export const WorkspaceWelcomeSurface = ({
  loading,
  busy,
  workspaces,
  workspacePath,
  avatar,
  snapshot,
  selectedRoomIds,
  selectedTerminalIds,
  roomRoles,
  terminalRoles,
  onWorkspacePathChange,
  onAvatarChange,
  onToggleRoom,
  onToggleTerminal,
  onRoomRoleChange,
  onTerminalRoleChange,
  onRefresh,
  onOpenChats,
  onOpenTerminals,
  onStart,
}: WorkspaceWelcomeSurfaceProps) => {
  return (
    <section
      className={cn(
        surfaceToneClassName("panel"),
        "grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-2xl p-4 shadow-sm",
      )}
    >
      <div className="space-y-3 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="typo-title-3 text-slate-900">Welcome</h2>
            <p className="mt-1 text-xs text-slate-500">
              Compose one avatar, then attach the rooms and terminals it should enter.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading || busy}>
            <ButtonLeadingVisual>
              <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </ButtonLeadingVisual>
            <ButtonLabel>Refresh</ButtonLabel>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(15rem,0.7fr)]">
          <Label className="grid gap-1 text-xs text-slate-600">
            <span>Workspace</span>
            <Select value={workspacePath} onChange={(event) => onWorkspacePathChange(event.currentTarget.value)}>
              {workspaces.map((workspace) => (
                <option key={workspace.path} value={workspace.path}>
                  {describeWorkspace(workspace)}
                </option>
              ))}
            </Select>
          </Label>

          <Label className="grid gap-1 text-xs text-slate-600">
            <span>Avatar</span>
            <Input value={avatar} onChange={(event) => onAvatarChange(event.target.value)} placeholder="default" />
          </Label>
        </div>

        {snapshot ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge variant="secondary">{snapshot.sessionId}</Badge>
            <Badge variant="secondary">{snapshot.avatars.length} known avatars</Badge>
            <Badge variant="secondary">{selectedRoomIds.length} rooms</Badge>
            <Badge variant="secondary">{selectedTerminalIds.length} terminals</Badge>
          </div>
        ) : null}
      </div>

      <ScrollViewport className="h-full pr-1" data-testid="workspace-welcome-scroll-viewport">
        <div className="grid gap-4 pt-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessagesSquare className="h-4 w-4 text-teal-700" />
                <h3 className="text-sm font-semibold text-slate-900">Rooms</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={onOpenChats}>
                Open Chats
              </Button>
            </div>
            <div className="space-y-2">
              {snapshot?.rooms.length ? (
                snapshot.rooms.map((room) => {
                  const selected = selectedRoomIds.includes(room.channel.chatId);
                  return (
                    <article
                      key={room.channel.chatId}
                      className={cn(
                        "rounded-xl border p-3 transition-colors",
                        selected ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-slate-50/70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <CardButton
                          onClick={() => onToggleRoom(room.channel.chatId)}
                          className="min-w-0 flex-1 border-transparent bg-transparent px-0 py-0 shadow-none hover:border-transparent hover:bg-transparent"
                        >
                          <div className="text-sm font-medium text-slate-900">
                            {room.channel.title || room.channel.chatId}
                          </div>
                          <div className="mt-1 text-[11px] break-all text-slate-500">{room.channel.chatId}</div>
                        </CardButton>
                        <Badge variant={accessTone(room.accessState)}>{room.accessState}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {room.canAuthorize ? <Badge variant="secondary">can authorize</Badge> : null}
                        {room.seatRole ? <Badge variant="secondary">seat:{room.seatRole}</Badge> : null}
                      </div>
                      {selected ? (
                        <div className="mt-3 grid gap-2">
                          <Label className="grid gap-1 text-xs text-slate-600">
                            <span>Grant role</span>
                            <Select
                              value={roomRoles[room.channel.chatId] ?? "member"}
                              onChange={(event) =>
                                onRoomRoleChange(
                                  room.channel.chatId,
                                  event.currentTarget.value as "admin" | "member" | "readonly",
                                )
                              }
                            >
                              <option value="member">member</option>
                              <option value="readonly">readonly</option>
                              <option value="admin">admin</option>
                            </Select>
                          </Label>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">
                  No rooms yet. Create one in Chats, then return here.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <TerminalSquare className="h-4 w-4 text-teal-700" />
                <h3 className="text-sm font-semibold text-slate-900">Terminals</h3>
              </div>
              <Button size="sm" variant="ghost" onClick={onOpenTerminals}>
                Open Terminals
              </Button>
            </div>
            <div className="space-y-2">
              {snapshot?.terminals.length ? (
                snapshot.terminals.map((terminal) => {
                  const selected = selectedTerminalIds.includes(terminal.terminal.terminalId);
                  return (
                    <article
                      key={terminal.terminal.terminalId}
                      className={cn(
                        "rounded-xl border p-3 transition-colors",
                        selected ? "border-teal-300 bg-teal-50/60" : "border-slate-200 bg-slate-50/70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <CardButton
                          onClick={() => onToggleTerminal(terminal.terminal.terminalId)}
                          className="min-w-0 flex-1 border-transparent bg-transparent px-0 py-0 shadow-none hover:border-transparent hover:bg-transparent"
                        >
                          <div className="text-sm font-medium text-slate-900">
                            {terminal.terminal.title || terminal.terminal.terminalId}
                          </div>
                          <div className="mt-1 text-[11px] break-all text-slate-500">{terminal.terminal.cwd}</div>
                        </CardButton>
                        <Badge variant={accessTone(terminal.accessState)}>{terminal.accessState}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {terminal.canAuthorize ? <Badge variant="secondary">can authorize</Badge> : null}
                        {terminal.seatRole ? <Badge variant="secondary">seat:{terminal.seatRole}</Badge> : null}
                      </div>
                      {selected ? (
                        <div className="mt-3 grid gap-2">
                          <Label className="grid gap-1 text-xs text-slate-600">
                            <span>Grant role</span>
                            <Select
                              value={terminalRoles[terminal.terminal.terminalId] ?? "writer"}
                              onChange={(event) =>
                                onTerminalRoleChange(
                                  terminal.terminal.terminalId,
                                  event.currentTarget.value as "admin" | "writer" | "requester" | "readonly",
                                )
                              }
                            >
                              <option value="writer">writer</option>
                              <option value="requester">requester</option>
                              <option value="readonly">readonly</option>
                              <option value="admin">admin</option>
                            </Select>
                          </Label>
                        </div>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/80 p-4 text-sm text-slate-500">
                  No terminals yet. Create one in Terminals, then return here.
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-teal-700" />
                <h3 className="text-sm font-semibold text-slate-900">Launch</h3>
              </div>
              <p className="text-xs text-slate-500">
                Starting reuses the stable session for the same workspace and avatar pair.
              </p>
            </div>
            <Button onClick={onStart} disabled={loading || busy || !workspacePath || avatar.trim().length === 0}>
              <ButtonLeadingVisual>
                <Play className="h-4 w-4" />
              </ButtonLeadingVisual>
              <ButtonLabel>{busy ? "Starting..." : "Start Avatar"}</ButtonLabel>
            </Button>
          </div>
        </section>
      </ScrollViewport>
    </section>
  );
};

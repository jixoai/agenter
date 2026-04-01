import { Copy, Crosshair, Shield, Users } from "lucide-react";
import { useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ScrollViewport, ViewportMask } from "../../components/ui/overflow-surface";
import { ProfileImage } from "../../components/ui/profile-image";

export interface RoomUserEntry {
  actorId: string;
  actorKind: "auth" | "session" | "system";
  label: string;
  subtitle?: string;
  roleLabel: "admin" | "member" | "readonly" | "participant";
  accessToken?: string;
  iconUrl?: string | null;
  currentCaller: boolean;
  currentAdmin: boolean;
  online: boolean;
  focused: boolean;
  invalidCredential: boolean;
  readStatus: "read" | "unread" | "idle";
  readAt?: number;
}

interface RoomUsersPanelProps {
  roomId: string | null;
  loading: boolean;
  users: RoomUserEntry[];
  onSetUserFocus?: (input: { actorId: string; accessToken: string; focused: boolean }) => Promise<void> | void;
}

export const RoomUsersPanel = ({ roomId, loading, users, onSetUserFocus }: RoomUsersPanelProps) => {
  const [busyActorId, setBusyActorId] = useState<string | null>(null);
  const formatReadAt = (timestamp: number): string =>
    new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));

  return (
    <ViewportMask className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Users className="h-4 w-4 text-slate-500" />
          <h3 className="typo-title-3 text-slate-900">Users</h3>
          {roomId ? <Badge variant="secondary">{roomId}</Badge> : null}
          <Badge variant="secondary">{loading ? "Loading..." : `${users.length} seats`}</Badge>
        </div>
      </div>

      <ScrollViewport className="h-full px-3 py-3">
        {users.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            No user seats are visible for this room yet.
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const actionBusy = busyActorId === user.actorId;
              const accessToken = user.accessToken;
              const canSetFocus = Boolean(accessToken) && !user.invalidCredential && Boolean(onSetUserFocus);
              return (
                <article key={`${user.actorId}:${user.accessToken ?? "participant"}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <ProfileImage src={user.iconUrl} label={user.label} className="h-10 w-10 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{user.label}</p>
                        <Badge variant="secondary">{user.actorKind}</Badge>
                        <Badge variant={user.roleLabel === "admin" ? "warning" : "secondary"}>{user.roleLabel}</Badge>
                        {user.currentAdmin ? (
                          <Badge variant="warning">
                            <Shield className="h-3 w-3" />
                            current admin
                          </Badge>
                        ) : null}
                        {user.currentCaller ? <Badge variant="success">caller</Badge> : null}
                        {user.invalidCredential ? <Badge variant="destructive">credential invalid</Badge> : null}
                        <Badge
                          variant={user.readStatus === "read" ? "success" : user.readStatus === "unread" ? "warning" : "secondary"}
                        >
                          {user.readStatus === "read" ? "read" : user.readStatus === "unread" ? "unread" : "no visible message"}
                        </Badge>
                      </div>
                      <p className="break-all text-xs text-slate-500">{user.subtitle ?? user.actorId}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge variant="secondary">{user.online ? "online" : "offline"}</Badge>
                        {user.focused ? (
                          <Badge variant="secondary">
                            <Crosshair className="h-3 w-3" />
                            focused
                          </Badge>
                        ) : null}
                        {user.readAt ? (
                          <span>{user.readStatus === "read" ? `Read ${formatReadAt(user.readAt)}` : `Last read ${formatReadAt(user.readAt)}`}</span>
                        ) : user.readStatus === "idle" ? (
                          <span>No visible room message has been delivered yet.</span>
                        ) : (
                          <span>No read receipt has been recorded for this seat yet.</span>
                        )}
                      </div>
                      {accessToken ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {canSetFocus ? (
                            <Button
                              type="button"
                              size="sm"
                              variant={user.focused ? "secondary" : "outline"}
                              disabled={busyActorId !== null}
                              aria-label={`${user.focused ? "Unfocus" : "Focus"} ${user.label}`}
                              onClick={() => {
                                if (!accessToken || !onSetUserFocus) {
                                  return;
                                }
                                setBusyActorId(user.actorId);
                                void Promise.resolve(
                                  onSetUserFocus({
                                    actorId: user.actorId,
                                    accessToken,
                                    focused: user.focused,
                                  }),
                                )
                                  .catch(() => undefined)
                                  .finally(() => {
                                    setBusyActorId((current) => (current === user.actorId ? null : current));
                                  });
                              }}
                            >
                              <Crosshair className="h-3.5 w-3.5" />
                              {actionBusy ? "Updating..." : user.focused ? "Unfocus" : "Focus"}
                            </Button>
                          ) : null}
                          <code className="rounded bg-white px-2 py-1 text-[11px] text-slate-600">{accessToken}</code>
                          {typeof navigator !== "undefined" && navigator.clipboard?.writeText ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                void navigator.clipboard.writeText(accessToken);
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </Button>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">No token is currently visible for this participant.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </ScrollViewport>
    </ViewportMask>
  );
};

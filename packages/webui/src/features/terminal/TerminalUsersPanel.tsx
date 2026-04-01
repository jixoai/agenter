import { Copy, Crosshair, Shield, Users } from "lucide-react";
import { useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { ScrollViewport, ViewportMask } from "../../components/ui/overflow-surface";
import { ProfileImage } from "../../components/ui/profile-image";

export interface TerminalUserEntry {
  actorId: string;
  actorKind: "auth" | "session" | "system";
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
  role: "admin" | "writer" | "requester" | "readonly";
  currentAdmin: boolean;
  online: boolean;
  focused: boolean;
  invalidCredential: boolean;
  accessToken?: string;
  currentCaller: boolean;
}

interface TerminalUsersPanelProps {
  terminalId: string;
  loading: boolean;
  users: TerminalUserEntry[];
  canManageAccess?: boolean;
  onManageAccess?: () => void;
  onSetUserFocus?: (input: { actorId: string; accessToken: string; focused: boolean }) => Promise<void> | void;
}

const onlineLabel = (user: Pick<TerminalUserEntry, "online" | "focused">): string => {
  if (!user.online && user.focused) {
    return "offline + focused";
  }
  if (!user.online) {
    return "offline";
  }
  return user.focused ? "online + focused" : "online";
};

export const TerminalUsersPanel = ({
  terminalId,
  loading,
  users,
  canManageAccess = false,
  onManageAccess,
  onSetUserFocus,
}: TerminalUsersPanelProps) => {
  const [busyActorId, setBusyActorId] = useState<string | null>(null);

  return (
    <ViewportMask className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-slate-500" />
            <h3 className="typo-title-3 text-slate-900">Users</h3>
            <Badge variant="secondary">{terminalId}</Badge>
            <Badge variant="secondary">{loading ? "Loading..." : `${users.length} seats`}</Badge>
          </div>
          {canManageAccess && onManageAccess ? (
            <Button type="button" size="sm" variant="outline" onClick={onManageAccess}>
              <Shield className="h-3.5 w-3.5" />
              Manage access
            </Button>
          ) : null}
        </div>
      </div>

      <ScrollViewport className="h-full px-3 py-3">
        {users.length === 0 ? (
          <div className="space-y-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
            <p>No terminal seats are visible for this terminal yet.</p>
            {canManageAccess && onManageAccess ? (
              <Button type="button" size="sm" variant="outline" onClick={onManageAccess}>
                <Shield className="h-3.5 w-3.5" />
                Add first user
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user) => {
              const actionBusy = busyActorId === user.actorId;
              const accessToken = user.accessToken;
              const canSetFocus = Boolean(user.accessToken) && !user.invalidCredential && Boolean(onSetUserFocus);
              return (
                <article key={user.actorId} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-start gap-3">
                    <ProfileImage src={user.iconUrl} label={user.label} className="h-10 w-10 rounded-2xl" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{user.label}</p>
                        <Badge variant="secondary">{user.actorKind}</Badge>
                        <Badge variant={user.role === "admin" ? "warning" : user.role === "writer" ? "success" : "secondary"}>
                          {user.role}
                        </Badge>
                        {user.currentAdmin ? (
                          <Badge variant="warning">
                            <Shield className="h-3 w-3" />
                            current admin
                          </Badge>
                        ) : null}
                        {user.currentCaller ? <Badge variant="success">caller</Badge> : null}
                        {user.invalidCredential ? <Badge variant="destructive">credential invalid</Badge> : null}
                      </div>
                      <p className="break-all text-xs text-slate-500">{user.subtitle ?? user.actorId}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{onlineLabel(user)}</Badge>
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
                        {accessToken ? (
                          <>
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
                          </>
                        ) : null}
                      </div>
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

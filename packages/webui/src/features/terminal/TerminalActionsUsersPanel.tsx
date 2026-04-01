import type { TerminalActivityItem } from "@agenter/client-sdk";
import { LoaderCircle, TerminalSquare } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "../../components/ui/button";
import { NoticeBanner } from "../../components/ui/notice-banner";
import { ScrollViewport, ViewportMask } from "../../components/ui/overflow-surface";
import { ProfileImage } from "../../components/ui/profile-image";
import { Select } from "../../components/ui/select";
import { Tabs, type TabItem } from "../../components/ui/tabs";
import { Textarea } from "../../components/ui/textarea";
import { ActorTokenSelect, type ActorTokenOption } from "../collaboration/ActorTokenSelect";
import { TerminalUsersPanel, type TerminalUserEntry } from "./TerminalUsersPanel";
import { renderTerminalActivityCard } from "./terminal-activity-views";

interface TerminalActionActorMeta {
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
}

interface TerminalActionsUsersPanelProps {
  terminalId: string;
  items: TerminalActivityItem[];
  users: TerminalUserEntry[];
  canManageAccess?: boolean;
  callerOptions: ActorTokenOption[];
  selectedCallerToken: string | null;
  activityHasMore: boolean;
  activityLoading: boolean;
  activityLoadingOlder: boolean;
  usersLoading: boolean;
  error: string | null;
  onSelectCallerToken: (accessToken: string) => void;
  onManageAccess?: () => void;
  onLoadMore: () => Promise<void> | void;
  onSetUserFocus: (input: { actorId: string; accessToken: string; focused: boolean }) => Promise<void> | void;
  onRead: (input: {
    accessToken?: string;
    mode?: "auto" | "diff" | "snapshot";
    remark?: boolean;
  }) => Promise<void> | void;
  onWrite: (input: {
    accessToken?: string;
    text: string;
    submit?: boolean;
    submitKey?: "enter" | "linefeed";
  }) => Promise<void> | void;
  resolveActorMeta: (actorId?: string) => TerminalActionActorMeta | null;
}

const PANEL_TABS: TabItem[] = [
  { id: "actions", label: "Actions" },
  { id: "users", label: "Users" },
];

const TOOL_TABS: TabItem[] = [
  { id: "write", label: "Write" },
  { id: "read", label: "Read" },
];

export const TerminalActionsUsersPanel = ({
  terminalId,
  items,
  users,
  canManageAccess = false,
  callerOptions,
  selectedCallerToken,
  activityHasMore,
  activityLoading,
  activityLoadingOlder,
  usersLoading,
  error,
  onSelectCallerToken,
  onManageAccess,
  onLoadMore,
  onSetUserFocus,
  onRead,
  onWrite,
  resolveActorMeta,
}: TerminalActionsUsersPanelProps) => {
  const [activeTab, setActiveTab] = useState<"actions" | "users">("actions");
  const [toolTab, setToolTab] = useState<"write" | "read">("write");
  const [writeText, setWriteText] = useState("");
  const [writeSubmit, setWriteSubmit] = useState(true);
  const [writeSubmitKey, setWriteSubmitKey] = useState<"enter" | "linefeed">("enter");
  const [readMode, setReadMode] = useState<"auto" | "diff" | "snapshot">("auto");
  const [readRemark, setReadRemark] = useState(false);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [toolBusy, setToolBusy] = useState(false);

  const orderedItems = useMemo(() => items.slice().sort((left, right) => left.createdAt - right.createdAt), [items]);

  return (
    <ViewportMask className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <Tabs items={PANEL_TABS} value={activeTab} ariaLabel="Terminal side panels" onValueChange={(value) => setActiveTab(value as "actions" | "users")} />
      </div>

      {activeTab === "users" ? (
        <div className="min-h-0">
          <TerminalUsersPanel
            terminalId={terminalId}
            loading={usersLoading}
            users={users}
            canManageAccess={canManageAccess}
            onManageAccess={onManageAccess}
            onSetUserFocus={onSetUserFocus}
          />
        </div>
      ) : (
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
            <div className="inline-flex items-center gap-2 text-sm text-slate-600">
              <TerminalSquare className="h-4 w-4" />
              <span>{terminalId}</span>
            </div>
            <Button size="sm" variant="secondary" onClick={onLoadMore} disabled={!activityHasMore || activityLoading || activityLoadingOlder}>
              {activityLoading || activityLoadingOlder ? "Loading..." : activityHasMore ? "Load older" : "Complete"}
            </Button>
          </div>

          <ScrollViewport className="h-full px-3 py-3">
            <div className="space-y-3">
              {error ? <NoticeBanner tone="destructive">{error}</NoticeBanner> : null}
              {orderedItems.length === 0 && !activityLoading ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No terminal actions are visible yet.
                </div>
              ) : null}
              {orderedItems.map((item) => {
                const actor = resolveActorMeta(item.actorId);
                const label = actor?.label ?? (item.actorId ? item.actorId : "system");
                return (
                  <article key={item.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                    <ProfileImage src={actor?.iconUrl} label={label} className="h-9 w-9 rounded-2xl" />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-medium text-slate-700">{label}</span>
                        <span>{new Date(item.createdAt).toLocaleTimeString()}</span>
                      </div>
                      {renderTerminalActivityCard(item)}
                    </div>
                  </article>
                );
              })}
            </div>
          </ScrollViewport>

          <div className="border-t border-slate-200 bg-white/94 px-3 py-3 backdrop-blur">
            <div className="grid gap-3">
              <ActorTokenSelect
                label="Call as"
                emptyLabel="No terminal token available"
                value={selectedCallerToken}
                options={callerOptions}
                onChange={onSelectCallerToken}
              />

              <Tabs items={TOOL_TABS} value={toolTab} ariaLabel="Terminal tools" onValueChange={(value) => setToolTab(value as "write" | "read")} />

              {toolTab === "write" ? (
                <div className="grid gap-3">
                  <Textarea
                    value={writeText}
                    onChange={(event) => setWriteText(event.target.value)}
                    placeholder="Write text into the terminal"
                  />
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                    <label className="grid gap-1 text-xs text-slate-600">
                      <span>Submit key</span>
                      <Select value={writeSubmitKey} onChange={(event) => setWriteSubmitKey(event.currentTarget.value as "enter" | "linefeed")}>
                        <option value="enter">enter</option>
                        <option value="linefeed">linefeed</option>
                      </Select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={writeSubmit} onChange={(event) => setWriteSubmit(event.currentTarget.checked)} />
                      <span>Submit after write</span>
                    </label>
                    <Button
                      type="button"
                      disabled={toolBusy || !selectedCallerToken || writeText.trim().length === 0}
                      onClick={() => {
                        setToolBusy(true);
                        setToolStatus(null);
                        void Promise.resolve(onWrite({
                          accessToken: selectedCallerToken ?? undefined,
                          text: writeText,
                          submit: writeSubmit,
                          submitKey: writeSubmitKey,
                        }))
                          .then(() => {
                            setToolStatus("terminal_write sent.");
                            setWriteText("");
                          })
                          .catch((submitError) => {
                            setToolStatus(submitError instanceof Error ? submitError.message : String(submitError));
                          })
                          .finally(() => {
                            setToolBusy(false);
                          });
                      }}
                    >
                      {toolBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                      Run write
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                    <label className="grid gap-1 text-xs text-slate-600">
                      <span>Read mode</span>
                      <Select value={readMode} onChange={(event) => setReadMode(event.currentTarget.value as "auto" | "diff" | "snapshot")}>
                        <option value="auto">auto</option>
                        <option value="diff">diff</option>
                        <option value="snapshot">snapshot</option>
                      </Select>
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" checked={readRemark} onChange={(event) => setReadRemark(event.currentTarget.checked)} />
                      <span>Mark diff baseline</span>
                    </label>
                  </div>
                  <Button
                    type="button"
                    disabled={toolBusy || !selectedCallerToken}
                    onClick={() => {
                      setToolBusy(true);
                      setToolStatus(null);
                      void Promise.resolve(onRead({
                        accessToken: selectedCallerToken ?? undefined,
                        mode: readMode,
                        remark: readRemark,
                      }))
                        .then(() => {
                          setToolStatus("terminal_read captured.");
                        })
                        .catch((readError) => {
                          setToolStatus(readError instanceof Error ? readError.message : String(readError));
                        })
                        .finally(() => {
                          setToolBusy(false);
                        });
                    }}
                  >
                    {toolBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Run read
                  </Button>
                </div>
              )}

              {toolStatus ? <p className="text-xs text-slate-500">{toolStatus}</p> : null}
            </div>
          </div>
        </div>
      )}
    </ViewportMask>
  );
};

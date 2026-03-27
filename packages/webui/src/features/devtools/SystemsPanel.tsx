import type { CachedResourceState, MessageChannelEntry } from "@agenter/client-sdk";
import { MessageCircleMore, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useAppController, useRuntimeSelector } from "../../app-context";
import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Badge } from "../../components/ui/badge";
import { HelpHint } from "../../components/ui/help-hint";
import { JSONViewer } from "../../components/ui/json-viewer";
import { ScrollViewport, ViewportMask } from "../../components/ui/overflow-surface";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { MessageChannelMetadataDisclosure } from "../chat/message-channel-metadata-disclosure";
import { TasksPanel } from "../tasks/TasksPanel";

type SystemsTab = "messages" | "tasks";

interface SystemsPanelProps {
  sessionId: string;
  loading: boolean;
}

const EMPTY_TASKS: never[] = [];
const EMPTY_MESSAGE_CHANNELS_RESOURCE = {
  data: [],
  loaded: false,
  loading: false,
  refreshing: false,
  error: null,
  refreshedAt: null,
} as const satisfies CachedResourceState<MessageChannelEntry[]>;

const ChannelRow = ({
  channel,
  selected,
  onSelect,
}: {
  channel: MessageChannelEntry;
  selected: boolean;
  onSelect: (chatId: string) => void;
}) => {
  const Icon = channel.kind === "room" ? Users : MessageCircleMore;
  return (
    <button
      type="button"
      onClick={() => onSelect(channel.chatId)}
      className={cn(
        "w-full rounded-xl border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-slate-900 bg-slate-900 text-white"
          : "border-slate-200 bg-white text-slate-800 hover:border-slate-300",
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", selected ? "text-white" : "text-slate-500")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium">{channel.title}</span>
            {channel.focused ? (
              <Badge className={selected ? "bg-white/15 text-white" : "bg-emerald-100 text-emerald-700"}>focused</Badge>
            ) : null}
            <Badge variant="secondary" className={selected ? "bg-white/12 text-white/80" : ""}>
              {channel.kind}
            </Badge>
          </div>
          <p className={cn("mt-1 text-[11px]", selected ? "text-white/78" : "text-slate-500")}>
            {channel.chatId} · participants {channel.participants.length} · access {channel.accessRole}
          </p>
        </div>
      </div>
    </button>
  );
};

export const SystemsPanel = ({ sessionId, loading }: SystemsPanelProps) => {
  const controller = useAppController();
  const runtime = useRuntimeSelector((state) => state.runtimes[sessionId]);
  const tasks = useRuntimeSelector((state) => state.tasksBySession[sessionId] ?? EMPTY_TASKS);
  const channelsResource = useRuntimeSelector(
    (state) => state.messageChannelsBySession[sessionId] ?? EMPTY_MESSAGE_CHANNELS_RESOURCE,
  );
  const [tab, setTab] = useState<SystemsTab>("messages");
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const channels = channelsResource.data;
  const channelsLoading = channelsResource.loading || channelsResource.refreshing;
  const channelsError = channelsResource.error;

  useEffect(() => {
    void controller.ensureMessageChannels(sessionId);
  }, [controller, sessionId]);

  useEffect(() => {
    if (channels.length === 0) {
      setSelectedChatId(null);
      return;
    }
    const focused = channels.find((entry) => entry.focused);
    setSelectedChatId((current) =>
      current && channels.some((entry) => entry.chatId === current)
        ? current
        : (focused?.chatId ?? channels[0]?.chatId ?? null),
    );
  }, [channels]);

  const selectedChannel = useMemo(
    () => channels.find((entry) => entry.chatId === selectedChatId) ?? channels[0] ?? null,
    [channels, selectedChatId],
  );

  const renderMessages = () => (
    <AsyncSurface
      state={resolveAsyncSurfaceState({ loading: loading || channelsLoading, hasData: channels.length > 0 })}
      loadingOverlayLabel="Refreshing message channels..."
      skeleton={<div className="h-full rounded-2xl bg-slate-100" />}
      empty={
        <div className="flex h-full items-center justify-center rounded-2xl bg-slate-50 px-4 text-sm text-slate-500">
          No message channels are attached to this session yet.
        </div>
      }
      className="h-full"
    >
      <ViewportMask className="grid h-full gap-3 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-slate-50">
          <div className="border-b border-slate-200 px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="typo-title-3 text-slate-900">Messages</h3>
              <HelpHint
                textContext="Chat channels are message-system instances. Only message egress that lands here becomes visible to users."
                content="Chat channels are message-system instances. Only message egress that lands here becomes visible to users."
              />
              <Badge variant="secondary">{channels.length} channels</Badge>
              {channels.filter((entry) => entry.focused).length > 0 ? (
                <Badge className="bg-emerald-100 text-emerald-700">
                  {channels.filter((entry) => entry.focused).length} focused
                </Badge>
              ) : null}
            </div>
            {channelsError ? <p className="mt-2 text-xs text-rose-700">{channelsError}</p> : null}
          </div>
          <ScrollViewport className="h-full px-2 py-2">
            <div className="space-y-2">
              {channels.map((channel) => (
                <ChannelRow
                  key={channel.chatId}
                  channel={channel}
                  selected={channel.chatId === selectedChannel?.chatId}
                  onSelect={setSelectedChatId}
                />
              ))}
            </div>
          </ScrollViewport>
        </section>

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            {selectedChannel ? (
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="typo-title-3 truncate text-slate-900">{selectedChannel.title}</h3>
                    <Badge variant="secondary">{selectedChannel.chatId}</Badge>
                    {selectedChannel.contextId ? <Badge variant="secondary">{selectedChannel.contextId}</Badge> : null}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    owner {selectedChannel.owner} · access {selectedChannel.accessRole} · participants{" "}
                    {selectedChannel.participants.length}
                  </p>
                </div>
                <MessageChannelMetadataDisclosure
                  channel={selectedChannel}
                  onUpdateChannel={({ channel, patch }) =>
                    controller.updateMessageChannel({
                      sessionId,
                      chatId: channel.chatId,
                      accessToken: channel.accessToken,
                      patch,
                    })
                  }
                  onListChannelGrants={(channel) =>
                    controller.listMessageChannelGrants({
                      sessionId,
                      chatId: channel.chatId,
                      accessToken: channel.accessToken,
                    })
                  }
                  onIssueChannelGrant={(input) =>
                    controller.issueMessageChannelGrant({
                      sessionId,
                      chatId: input.channel.chatId,
                      accessToken: input.channel.accessToken,
                      role: input.role,
                      label: input.label,
                      participantId: input.participantId,
                    })
                  }
                  onRevokeChannelGrant={(input) =>
                    controller.revokeMessageChannelGrant({
                      sessionId,
                      chatId: input.channel.chatId,
                      accessToken: input.channel.accessToken,
                      grantId: input.grantId,
                    })
                  }
                />
              </div>
            ) : null}
          </div>
          <ScrollViewport className="h-full px-4 py-4">
            {selectedChannel ? (
              <div className="space-y-4">
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Transport</h4>
                  <JSONViewer
                    value={{
                      transportUrl: selectedChannel.transportUrl ?? null,
                      focused: selectedChannel.focused,
                      contextId: selectedChannel.contextId ?? null,
                      metadata: selectedChannel.metadata ?? {},
                    }}
                  />
                </section>
                <section className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Participants</h4>
                  <JSONViewer value={selectedChannel.participants} />
                </section>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">
                Select a message channel to inspect its system metadata.
              </div>
            )}
          </ScrollViewport>
        </section>
      </ViewportMask>
    </AsyncSurface>
  );

  return (
    <section className="grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-xl bg-white p-3 shadow-xs">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="typo-title-3 text-slate-900">Systems</h2>
            <HelpHint
              textContext="Message, terminal, and task systems are side-effect boundaries around the attention kernel."
              content="Message, terminal, and task systems are side-effect boundaries around the attention kernel."
            />
            <Badge variant="secondary">{channels.length} channels</Badge>
            <Badge variant="secondary">{tasks.length} tasks</Badge>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
        <Tabs
          items={[
            { id: "messages", label: `Messages (${channels.length})` },
            { id: "tasks", label: `Tasks (${tasks.length})` },
          ]}
          value={tab}
          onValueChange={(value) => setTab(value === "tasks" ? value : "messages")}
          ariaLabel="Systems tabs"
        />

        {tab === "messages" ? renderMessages() : null}
        {tab === "tasks" ? <TasksPanel tasks={tasks} loading={loading} /> : null}
      </div>
    </section>
  );
};

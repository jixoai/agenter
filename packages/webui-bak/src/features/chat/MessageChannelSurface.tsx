import type { MessageChannelEntry, MessageChannelGrantEntry, MessageChannelGrantIssueOutput } from "@agenter/client-sdk";
import {
  type WebChatComposerCapabilities,
  type WebChatMessage,
  type WebChatMessageAction,
  type WebChatMessageReadProgress,
  type WebChatMessageRenderInput,
  type WebChatNotice,
  type WebChatSocketFactory,
  type WebChatVisibleMessageFact,
} from "@agenter/web-chat-view";
import { Plus } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { AdaptiveIconButton } from "../../components/ui/adaptive-icon-button";
import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Tabs } from "../../components/ui/tabs";
import { cn } from "../../lib/utils";
import { MessageChannelCreateDialog, type MessageChannelCreateInput } from "./message-channel-create-dialog";
import { MessageChannelMetadataDisclosure } from "./message-channel-metadata-disclosure";
import { RoomReadProgressDisclosure } from "./RoomReadProgressDisclosure";
import type { RoomActorOption } from "./room-participants";
import { type AIInputCommand, type AIInputSubmitPayload, type AIInputSuggestion } from "./AIInput";
import { SLASH_COMMANDS } from "./ai-input-contract";
import { WebChatViewHost } from "./WebChatViewHost";

interface MessageChannelSurfaceProps {
  sessionId: string;
  workspacePath?: string | null;
  channels: MessageChannelEntry[];
  unreadByChat?: Record<string, number>;
  selectedChatId: string | null;
  channelsLoading?: boolean;
  channelsError?: string | null;
  disabled: boolean;
  imageCompatible: boolean;
  routeNotice?: WebChatNotice | null;
  initialMessages?: WebChatMessage[];
  assistantAvatarUrl?: string | null;
  assistantAvatarLabel?: string;
  userAvatarLabel?: string;
  onSelectChannel: (chatId: string) => void;
  onCreateChannel: (input: MessageChannelCreateInput) => Promise<void> | void;
  onArchiveChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onDeleteChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onSendMessage: (input: { channel: MessageChannelEntry; payload: AIInputSubmitPayload }) => Promise<void>;
  onUpdateChannel?: (input: {
    channel: MessageChannelEntry;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string }>;
      metadata?: Record<string, unknown>;
    };
  }) => Promise<MessageChannelEntry>;
  onListChannelGrants?: (channel: MessageChannelEntry) => Promise<MessageChannelGrantEntry[]>;
  onIssueChannelGrant?: (input: {
    channel: MessageChannelEntry;
    role: "admin" | "member" | "readonly";
    label?: string;
    participantId?: string;
  }) => Promise<MessageChannelGrantIssueOutput["grant"]>;
  actorOptions?: RoomActorOption[];
  onRevokeChannelGrant?: (input: { channel: MessageChannelEntry; grantId: string }) => Promise<{ ok: boolean }>;
  onCommand?: (command: AIInputCommand) => Promise<void> | void;
  onSearchPaths?: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
  onLatestVisibleAssistantMessageIdChange?: (messageId: string | null) => void;
  onLatestVisibleMessageIdChange?: (messageId: string | null) => void;
  readProgress?: MessageChannelEntry["readProgress"];
  readStates?: MessageChannelEntry["readStates"];
  socketFactory?: WebChatSocketFactory;
  onOpenDevtools?: (cycleId: number) => void;
  renderComposerAccessory?: (props: { channel: MessageChannelEntry; disabled: boolean }) => ReactNode;
  sidePanel?: ReactNode;
}

export const MessageChannelSurface = ({
  workspacePath,
  channels,
  unreadByChat = {},
  selectedChatId,
  channelsLoading = false,
  channelsError = null,
  disabled,
  imageCompatible,
  routeNotice = null,
  initialMessages,
  assistantAvatarUrl,
  assistantAvatarLabel,
  userAvatarLabel,
  onSelectChannel,
  onCreateChannel,
  onArchiveChannel,
  onDeleteChannel,
  onSendMessage,
  onUpdateChannel,
  onListChannelGrants,
  onIssueChannelGrant,
  actorOptions = [],
  onRevokeChannelGrant,
  onCommand,
  onSearchPaths,
  onLatestVisibleAssistantMessageIdChange,
  onLatestVisibleMessageIdChange,
  readProgress,
  readStates,
  socketFactory,
  onOpenDevtools,
  renderComposerAccessory,
  sidePanel,
}: MessageChannelSurfaceProps) => {
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.chatId === selectedChatId) ?? channels[0] ?? null,
    [channels, selectedChatId],
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const showEmptyChannelState = !channelsLoading && !channelsError && channels.length === 0;
  const emptyTitle = channelsError
    ? "Unable to load rooms"
    : showEmptyChannelState
      ? "No rooms yet"
      : "No room messages yet";
  const emptyMessage = channelsError
    ? channelsError
    : showEmptyChannelState
      ? "Create a room to start the conversation."
      : "Send a message to start this room.";
  const mentionSuggestions = useMemo(
    () =>
      actorOptions.map((actor) => ({
        id: actor.actorId,
        label: actor.label,
        detail: actor.subtitle,
        apply: `@${actor.label}`,
        iconUrl: actor.iconUrl ?? null,
      })),
    [actorOptions],
  );
  const composerCapabilities = useMemo<WebChatComposerCapabilities>(
    () => ({
      placeholder: selectedChannel ? "Message Agenter and use @ to reference files..." : "Create a room to start messaging.",
      attachmentEnabled: true,
      imageEnabled: true,
      screenshotEnabled: true,
      commandSuggestions: SLASH_COMMANDS,
      mentionSuggestions,
      resolveMentionSuggestions: onSearchPaths
        ? async (query) => {
            if (!workspacePath) {
              return mentionSuggestions;
            }
            const paths = await onSearchPaths({ cwd: workspacePath, query, limit: 8 });
            return [
              ...mentionSuggestions,
              ...paths.map((entry) => ({
                id: entry.path,
                label: entry.label,
                detail: entry.path,
                apply: `@${entry.path}`,
              })),
            ];
          }
        : undefined,
    }),
    [mentionSuggestions, onSearchPaths, selectedChannel, workspacePath],
  );
  const resolveMessageActions = useMemo(
    () =>
      onOpenDevtools
        ? (input: WebChatMessageRenderInput): readonly WebChatMessageAction[] => {
            const cycleId =
              typeof input.message.metadata?.cycleId === "number" && Number.isInteger(input.message.metadata.cycleId)
                ? input.message.metadata.cycleId
                : typeof input.message.rootId === "string" && Number.isInteger(Number(input.message.rootId))
                  ? Number(input.message.rootId)
                  : null;
            return cycleId === null
              ? []
              : [
                  {
                    id: "view-in-devtools",
                    label: "View In Devtools",
                    detail: "cycle",
                    onSelect: () => {
                      onOpenDevtools(cycleId);
                    },
                  },
                ];
          }
        : undefined,
    [onOpenDevtools],
  );
  const resolveMessageReadProgress = useMemo(
    () =>
      readProgress || (readStates?.length ?? 0) > 0
        ? (_input: WebChatMessageRenderInput): WebChatMessageReadProgress | null => {
            if (!readProgress) {
              return null;
            }
            return {
              readCount: readProgress.readSeatCount,
              totalCount: readProgress.totalSeatCount,
              title: "Read progress",
              readActors:
                readStates
                  ?.filter((state) => state.hasReadLatestVisible)
                  .map((state) => ({
                    actorId: state.actorId,
                    label: state.label,
                    subtitle: state.role,
                  })) ?? [],
              unreadActors:
                readStates
                  ?.filter((state) => !state.hasReadLatestVisible)
                  .map((state) => ({
                    actorId: state.actorId,
                    label: state.label,
                    subtitle: state.role,
                  })) ?? [],
            };
          }
        : undefined,
    [readProgress, readStates],
  );
  const handleLatestVisibleAssistantViewKeyChange = (viewKey: string | null) => {
    onLatestVisibleAssistantMessageIdChange?.(viewKey);
  };
  const handleLatestVisibleMessageChange = (message: WebChatVisibleMessageFact | null) => {
    onLatestVisibleMessageIdChange?.(message?.messageId !== undefined ? String(message.messageId) : message?.viewKey ?? null);
  };
  const handleSendMessage = async (payload: AIInputSubmitPayload): Promise<void> => {
    if (!selectedChannel) {
      return;
    }
    const command = payload.assets.length === 0 ? payload.text.trim() : null;
    if (command && onCommand && SLASH_COMMANDS.some((item) => item.label === command)) {
      await onCommand(command as AIInputCommand);
      return;
    }
    await onSendMessage({ channel: selectedChannel, payload });
  };

  const asyncState = resolveAsyncSurfaceState({
    loading: channelsLoading,
    hasData: Boolean(selectedChannel),
  });

  return (
    <div className="grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="min-w-0">
        <Tabs
          items={channels.map((channel) => ({
            id: channel.chatId,
            label: channel.title,
            badgeCount: unreadByChat[channel.chatId] ?? 0,
          }))}
          value={selectedChannel?.chatId ?? ""}
          ariaLabel="Rooms"
          onValueChange={onSelectChannel}
          trailing={
            <>
              {selectedChannel ? (
                <MessageChannelMetadataDisclosure
                  channel={selectedChannel}
                  onArchiveChannel={onArchiveChannel}
                  onDeleteChannel={onDeleteChannel}
                  onUpdateChannel={onUpdateChannel}
                  onListChannelGrants={onListChannelGrants}
                  onIssueChannelGrant={onIssueChannelGrant}
                  actorOptions={actorOptions}
                  onRevokeChannelGrant={onRevokeChannelGrant}
                />
              ) : null}
              {selectedChannel ? <RoomReadProgressDisclosure readProgress={readProgress} readStates={readStates} /> : null}
              <div className="flex min-w-0 items-center gap-1.5">
                <AdaptiveIconButton
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={channelsLoading}
                  icon={Plus}
                  label="New room"
                  tooltip="Create a room"
                  labelPriority="always"
                  onClick={() => setCreateDialogOpen(true)}
                  containerClassName="min-w-0"
                />
              </div>
            </>
          }
        />
      </div>

      <div
        className={cn(
          "grid min-h-0 gap-3",
          sidePanel ? "xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)]" : "grid-cols-[minmax(0,1fr)]",
        )}
      >
        <AsyncSurface
          state={asyncState}
          className="min-h-0"
          viewportClassName="h-full min-h-0"
          emptyLoadingLabel="Loading rooms..."
          loadingOverlayLabel="Refreshing rooms..."
          empty={
            <div className="flex h-full min-h-[20rem] items-center justify-center px-6 py-8 text-center">
              <div className="space-y-2">
                <h2 className="text-base font-semibold text-slate-900">{emptyTitle}</h2>
                <p className="max-w-md text-sm text-slate-500">{emptyMessage}</p>
              </div>
            </div>
          }
        >
          <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto]">
            <WebChatViewHost
              key={selectedChannel?.chatId ?? "empty"}
              channel={selectedChannel}
              initialMessages={initialMessages}
              disabled={disabled || !selectedChannel}
              showHeader={false}
              routeNotice={
                selectedChannel && channelsError
                  ? {
                      tone: "destructive",
                      message: channelsError,
                    }
                  : routeNotice
              }
              emptyTitle={emptyTitle}
              emptyMessage={emptyMessage}
              composerCapabilities={composerCapabilities}
              resolveMessageActions={resolveMessageActions}
              resolveMessageReadProgress={resolveMessageReadProgress}
              onSendMessage={handleSendMessage}
              onLatestVisibleAssistantViewKeyChange={handleLatestVisibleAssistantViewKeyChange}
              onLatestVisibleMessageChange={handleLatestVisibleMessageChange}
              socketFactory={socketFactory}
            />
            {selectedChannel && renderComposerAccessory ? (
              <div className="border-t border-slate-200 bg-white/94 px-2 py-2 backdrop-blur md:px-2.5 md:py-2.5">
                {renderComposerAccessory({ channel: selectedChannel, disabled: disabled || !selectedChannel })}
              </div>
            ) : null}
          </div>
        </AsyncSurface>
        {sidePanel ? <div className="min-h-0">{sidePanel}</div> : null}
      </div>
      <MessageChannelCreateDialog
        open={createDialogOpen}
        existingCount={channels.length}
        actorOptions={actorOptions}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={async (input) => {
          await onCreateChannel(input);
        }}
      />
    </div>
  );
};

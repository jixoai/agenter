import type { MessageChannelEntry, MessageChannelGrantEntry, MessageChannelGrantIssueOutput } from "@agenter/client-sdk";
import {
  WebChatView,
  type WebChatComposerRenderProps,
  type WebChatMessage,
  type WebChatMessageRenderInput,
  type WebChatNotice,
  type WebChatSocketFactory,
} from "@agenter/web-chat-view";
import { Crosshair, Plus } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { AdaptiveIconButton } from "../../components/ui/adaptive-icon-button";
import { AsyncSurface, resolveAsyncSurfaceState } from "../../components/ui/async-surface";
import { Tabs } from "../../components/ui/tabs";
import { MessageChannelBubble } from "./message-channel-bubble";
import { MessageChannelCreateDialog, type MessageChannelCreateInput } from "./message-channel-create-dialog";
import { MessageChannelMetadataDisclosure } from "./message-channel-metadata-disclosure";
import { AIInput, type AIInputCommand, type AIInputSubmitPayload, type AIInputSuggestion } from "./AIInput";

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
  onFocusChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onArchiveChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onSendMessage: (input: { channel: MessageChannelEntry; payload: AIInputSubmitPayload }) => Promise<void>;
  onUpdateChannel?: (input: {
    channel: MessageChannelEntry;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string; role?: "avatar" | "user" | "system" }>;
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
  onRevokeChannelGrant?: (input: { channel: MessageChannelEntry; grantId: string }) => Promise<{ ok: boolean }>;
  onCommand?: (command: AIInputCommand) => Promise<void> | void;
  onSearchPaths?: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
  onLatestVisibleAssistantMessageIdChange?: (messageId: string | null) => void;
  socketFactory?: WebChatSocketFactory;
  onOpenDevtools?: (cycleId: number) => void;
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
  onFocusChannel,
  onArchiveChannel,
  onSendMessage,
  onUpdateChannel,
  onListChannelGrants,
  onIssueChannelGrant,
  onRevokeChannelGrant,
  onCommand,
  onSearchPaths,
  onLatestVisibleAssistantMessageIdChange,
  socketFactory,
  onOpenDevtools,
}: MessageChannelSurfaceProps) => {
  const actionGroupRef = useRef<HTMLDivElement | null>(null);
  const selectedChannel = useMemo(
    () => channels.find((channel) => channel.chatId === selectedChatId) ?? channels[0] ?? null,
    [channels, selectedChatId],
  );
  const [collapseActionLabels, setCollapseActionLabels] = useState(false);
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

  useLayoutEffect(() => {
    const container = actionGroupRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const update = () => {
      setCollapseActionLabels(container.clientWidth < 268);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  const renderComposer = (props: WebChatComposerRenderProps) => (
    <div className="border-t border-slate-200 bg-white/94 px-2 py-2 backdrop-blur md:px-2.5 md:py-2.5">
      <AIInput
        workspacePath={workspacePath}
        placeholder={selectedChannel ? "Message Agenter and use @ to reference files..." : "Create a room to start messaging."}
        disabled={props.disabled}
        imageEnabled
        imageCompatible={imageCompatible}
        onSubmit={(payload) => onSendMessage({ channel: props.channel, payload })}
        onCommand={onCommand}
        onSearchPaths={onSearchPaths}
      />
    </div>
  );

  const renderMessage = (input: WebChatMessageRenderInput) => (
    <MessageChannelBubble
      message={input.message}
      isAssistant={input.isAssistant}
      assistantAvatarUrl={assistantAvatarUrl}
      assistantAvatarLabel={assistantAvatarLabel}
      userAvatarLabel={userAvatarLabel}
      onOpenDevtools={onOpenDevtools}
      onSubmitInteractive={input.onSubmitInteractive}
    />
  );

  const asyncState = resolveAsyncSurfaceState({
    loading: channelsLoading,
    hasData: Boolean(selectedChannel),
  });
  const canToggleSelectedChannelFocus = Boolean(
    selectedChannel && onFocusChannel && selectedChannel.accessRole === "admin",
  );

  return (
    <div className="grid h-full min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-3">
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
                  onFocusChannel={onFocusChannel}
                  onArchiveChannel={onArchiveChannel}
                  onUpdateChannel={onUpdateChannel}
                  onListChannelGrants={onListChannelGrants}
                  onIssueChannelGrant={onIssueChannelGrant}
                  onRevokeChannelGrant={onRevokeChannelGrant}
                />
              ) : null}
              <div ref={actionGroupRef} className="flex min-w-0 items-center gap-1.5">
                {selectedChannel && onFocusChannel ? (
                  <AdaptiveIconButton
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canToggleSelectedChannelFocus || disabled}
                    icon={Crosshair}
                    label={selectedChannel.focused ? "Unfocus" : "Focus"}
                    tooltip={
                      selectedChannel.focused
                        ? "Remove this chat channel from semantic focus"
                        : "Add this chat channel to semantic focus"
                    }
                    labelPriority={collapseActionLabels ? "icon-only" : "always"}
                    onClick={() => {
                      void onFocusChannel(selectedChannel);
                    }}
                    containerClassName="min-w-0"
                  />
                ) : null}
                <AdaptiveIconButton
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled}
                  icon={Plus}
                  label="New room"
                  tooltip="Create a room"
                  labelPriority={collapseActionLabels ? "icon-only" : "always"}
                  onClick={() => setCreateDialogOpen(true)}
                  containerClassName="min-w-0"
                />
              </div>
            </>
          }
        />
      </div>

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
        <WebChatView
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
          renderComposer={renderComposer}
          renderMessage={renderMessage}
          onSendMessage={(payload) => (selectedChannel ? onSendMessage({ channel: selectedChannel, payload }) : Promise.resolve())}
          onLatestVisibleAssistantMessageIdChange={onLatestVisibleAssistantMessageIdChange}
          socketFactory={socketFactory}
        />
      </AsyncSurface>
      <MessageChannelCreateDialog
        open={createDialogOpen}
        ownerHint={selectedChannel?.owner ?? assistantAvatarLabel ?? "agenter"}
        existingCount={channels.length}
        onClose={() => setCreateDialogOpen(false)}
        onCreate={async (input) => {
          await onCreateChannel(input);
        }}
      />
    </div>
  );
};

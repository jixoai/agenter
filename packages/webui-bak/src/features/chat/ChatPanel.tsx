import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";
import { memo, useMemo, useRef, useState, type ReactNode } from "react";

import type { AsyncSurfaceState } from "../../components/ui/async-surface";
import { ChatAssetPreviewDialog } from "./ChatAssetPreviewDialog";
import { AIInput, type AIInputCommand, type AIInputSubmitPayload, type AIInputSuggestion } from "./AIInput";
import { ChatConversationViewport } from "./ChatConversationViewport";
import { projectConversationRows, stabilizeConversationRows } from "./chat-projection";

interface ChatPanelProps {
  sessionId?: string;
  workspacePath?: string | null;
  messages: RuntimeChatMessage[];
  cycles: RuntimeChatCycle[];
  aiStatus: string;
  sessionStateLabel: string;
  statusSlot?: ReactNode;
  conversationState?: AsyncSurfaceState;
  routeNotice?: {
    tone: "info" | "warning" | "destructive";
    message: string;
  } | null;
  disabled: boolean;
  imageEnabled?: boolean;
  imageCompatible?: boolean;
  assistantAvatarUrl?: string | null;
  assistantAvatarLabel?: string;
  userAvatarLabel?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  onSubmit: (payload: AIInputSubmitPayload) => Promise<void>;
  onCommand?: (command: AIInputCommand) => Promise<void> | void;
  onSearchPaths?: (input: { cwd: string; query: string; limit?: number }) => Promise<AIInputSuggestion[]>;
  onOpenDevtools?: (cycleId: number) => void;
  onLatestVisibleAssistantMessageIdChange?: (messageId: string | null) => void;
}

type ChatAttachment = NonNullable<RuntimeChatMessage["attachments"]>[number];

const ChatPanelComponent = ({
  workspacePath,
  messages,
  cycles,
  aiStatus,
  sessionStateLabel,
  statusSlot = null,
  conversationState,
  routeNotice = null,
  disabled,
  imageEnabled = false,
  imageCompatible = true,
  assistantAvatarUrl = null,
  assistantAvatarLabel = "Assistant",
  userAvatarLabel = "You",
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  onSubmit,
  onCommand,
  onSearchPaths,
  onOpenDevtools,
  onLatestVisibleAssistantMessageIdChange,
}: ChatPanelProps) => {
  const [previewAssetId, setPreviewAssetId] = useState<string | null>(null);
  const previousRowsRef = useRef<ReturnType<typeof projectConversationRows>>([]);

  const rows = useMemo(() => {
    const projected = projectConversationRows(messages, cycles, aiStatus);
    const stabilized = stabilizeConversationRows(projected, previousRowsRef.current);
    previousRowsRef.current = stabilized;
    return stabilized;
  }, [aiStatus, cycles, messages]);

  const attachmentsById = useMemo(() => {
    const entries = new Map<string, ChatAttachment>();
    for (const message of messages) {
      for (const attachment of message.attachments ?? []) {
        entries.set(attachment.assetId, attachment);
      }
    }
    for (const cycle of cycles) {
      for (const input of cycle.inputs) {
        for (const part of input.parts) {
          if (part.type !== "text") {
            entries.set(part.assetId, {
              assetId: part.assetId,
              kind: part.kind,
              mimeType: part.mimeType,
              name: part.name,
              sizeBytes: part.sizeBytes,
              url: part.url,
            });
          }
        }
      }
      for (const message of [...cycle.outputs, ...cycle.liveMessages]) {
        for (const attachment of message.attachments ?? []) {
          entries.set(attachment.assetId, attachment);
        }
      }
    }
    return entries;
  }, [cycles, messages]);

  const previewAttachment = previewAssetId ? attachmentsById.get(previewAssetId) ?? null : null;
  const inputPlaceholder = imageEnabled
    ? "Message Agenter, use @ to reference files, or attach files, videos, and images..."
    : "Message Agenter and use @ to reference files...";
  const hasStatusSlot = statusSlot !== null;
  const resolvedConversationState = conversationState ?? (rows.length > 0 ? "ready-idle" : "empty-idle");
  const panelRowsClassName = hasStatusSlot
    ? "grid-rows-[auto_minmax(0,1fr)_auto]"
    : "grid-rows-[minmax(0,1fr)_auto]";

  return (
    <section
      className={`grid h-full min-w-0 flex-1 grid-cols-[minmax(0,1fr)] ${panelRowsClassName} rounded-[1.45rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.96)_0%,rgba(241,245,249,0.92)_100%)] shadow-sm ring-1 ring-slate-200/80`}
      data-testid="chat-panel"
    >
      {hasStatusSlot ? (
        <div className="flex items-center border-b border-slate-200/80 px-2.5 py-2 md:px-3 md:py-2.5" data-testid="chat-route-status-strip">
          {statusSlot}
        </div>
      ) : null}

      <ChatConversationViewport
        rows={rows}
        sessionStateLabel={sessionStateLabel}
        conversationState={resolvedConversationState}
        routeNotice={routeNotice}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        assistantAvatarUrl={assistantAvatarUrl}
        assistantAvatarLabel={assistantAvatarLabel}
        userAvatarLabel={userAvatarLabel}
        onPreviewAttachment={setPreviewAssetId}
        onOpenDevtools={onOpenDevtools}
        onLatestVisibleAssistantMessageIdChange={onLatestVisibleAssistantMessageIdChange}
      />

      <div className="shrink-0 border-t border-slate-200/90 bg-white/94 px-2 py-2 backdrop-blur md:px-2.5 md:py-2.5">
        <AIInput
          workspacePath={workspacePath}
          placeholder={inputPlaceholder}
          disabled={disabled}
          imageEnabled={imageEnabled}
          imageCompatible={imageCompatible}
          onSubmit={onSubmit}
          onCommand={onCommand}
          onSearchPaths={onSearchPaths}
        />
      </div>

      <ChatAssetPreviewDialog asset={previewAttachment} onClose={() => setPreviewAssetId(null)} />
    </section>
  );
};

const chatPanelPropsEqual = (left: ChatPanelProps, right: ChatPanelProps): boolean => {
  return (
    left.sessionId === right.sessionId &&
    left.workspacePath === right.workspacePath &&
    left.messages === right.messages &&
    left.cycles === right.cycles &&
    left.aiStatus === right.aiStatus &&
    left.sessionStateLabel === right.sessionStateLabel &&
    left.statusSlot === right.statusSlot &&
    left.conversationState === right.conversationState &&
    left.routeNotice?.tone === right.routeNotice?.tone &&
    left.routeNotice?.message === right.routeNotice?.message &&
    left.disabled === right.disabled &&
    left.imageEnabled === right.imageEnabled &&
    left.imageCompatible === right.imageCompatible &&
    left.assistantAvatarUrl === right.assistantAvatarUrl &&
    left.assistantAvatarLabel === right.assistantAvatarLabel &&
    left.userAvatarLabel === right.userAvatarLabel &&
    left.hasMore === right.hasMore &&
    left.loadingMore === right.loadingMore
  );
};

export const ChatPanel = memo(ChatPanelComponent, chatPanelPropsEqual);
ChatPanel.displayName = "ChatPanel";

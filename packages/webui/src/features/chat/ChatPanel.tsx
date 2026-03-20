import type { RuntimeChatCycle, RuntimeChatMessage } from "@agenter/client-sdk";
import { useMemo, useState } from "react";

import { ChatAssetPreviewDialog } from "./ChatAssetPreviewDialog";
import { AIInput, type AIInputCommand, type AIInputSubmitPayload, type AIInputSuggestion } from "./AIInput";
import { ChatConversationViewport } from "./ChatConversationViewport";
import { projectConversationRows } from "./chat-projection";
import { SessionToolbar, type SessionToolbarTone } from "./SessionToolbar";

interface ChatPanelProps {
  workspacePath?: string | null;
  messages: RuntimeChatMessage[];
  cycles: RuntimeChatCycle[];
  aiStatus: string;
  sessionStateLabel: string;
  sessionStateTone?: SessionToolbarTone;
  routeNotice?: {
    tone: "info" | "warning" | "destructive";
    message: string;
  } | null;
  disabled: boolean;
  imageEnabled?: boolean;
  sessionActionLabel: string;
  sessionActionDisabled?: boolean;
  sessionActionPending?: boolean;
  onSessionAction: () => void;
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

export const ChatPanel = ({
  workspacePath,
  messages,
  cycles,
  aiStatus,
  sessionStateLabel,
  sessionStateTone = "neutral",
  routeNotice = null,
  disabled,
  imageEnabled = false,
  sessionActionLabel,
  sessionActionDisabled = false,
  sessionActionPending = false,
  onSessionAction,
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

  const rows = useMemo(() => projectConversationRows(messages, cycles, aiStatus), [aiStatus, cycles, messages]);

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

  return (
    <section className="flex h-full flex-1 flex-col rounded-[1.6rem] bg-white shadow-sm ring-1 ring-slate-200/80">
      <div className="shrink-0 border-b border-slate-200 px-4 py-3">
        <SessionToolbar
          sessionStateLabel={sessionStateLabel}
          sessionStateTone={sessionStateTone}
          actionLabel={sessionActionLabel}
          actionDisabled={sessionActionDisabled}
          actionPending={sessionActionPending}
          onAction={onSessionAction}
        />
      </div>

      <ChatConversationViewport
        rows={rows}
        sessionStateLabel={sessionStateLabel}
        routeNotice={routeNotice}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={onLoadMore}
        onPreviewAttachment={setPreviewAssetId}
        onOpenDevtools={onOpenDevtools}
        onLatestVisibleAssistantMessageIdChange={onLatestVisibleAssistantMessageIdChange}
      />

      <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3">
        <AIInput
          workspacePath={workspacePath}
          placeholder={inputPlaceholder}
          disabled={disabled}
          imageEnabled={imageEnabled}
          onSubmit={onSubmit}
          onCommand={onCommand}
          onSearchPaths={onSearchPaths}
        />
      </div>

      <ChatAssetPreviewDialog asset={previewAttachment} onClose={() => setPreviewAssetId(null)} />
    </section>
  );
};

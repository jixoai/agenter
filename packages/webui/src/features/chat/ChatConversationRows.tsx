import { AlertTriangle, Copy, Ellipsis, ExternalLink, LoaderCircle, Sparkles } from "lucide-react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/utils";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { resolveChatMessagePresentation } from "./chat-contract";
import { ChatAttachmentStrip } from "./ChatAttachmentStrip";
import type { ConversationRow, ProjectedConversationMessage } from "./chat-projection";

const rowShellClassName = "group w-fit max-w-[92%] md:max-w-[44rem]";

const markdownToPlainText = (value: string): string =>
  value
    .replace(/```[^\n]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[*_~]/g, "");

const copyToClipboard = async (value: string): Promise<void> => {
  if (typeof navigator === "undefined" || !navigator.clipboard) {
    return;
  }
  await navigator.clipboard.writeText(value);
};

const MessageActions = ({
  message,
  onOpenDevtools,
}: {
  message: ProjectedConversationMessage;
  onOpenDevtools?: (cycleId: number) => void;
}) => {
  const canOpenDevtools = typeof message.cycleId === "number" && Number.isFinite(message.cycleId);
  const triggerClassName =
    message.role === "user"
      ? "text-white/82 hover:bg-white/12"
      : "text-slate-500 hover:bg-slate-100";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Message actions"
        title="Message actions"
        className={cn(
          "absolute top-2 right-2 h-7 w-7 rounded-full p-0 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
          triggerClassName,
        )}
      >
        <Ellipsis className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            void copyToClipboard(message.content);
          }}
        >
          <Copy className="h-4 w-4" />
          Copy Markdown
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            void copyToClipboard(markdownToPlainText(message.content));
          }}
        >
          <Copy className="h-4 w-4" />
          Copy Text
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!canOpenDevtools}
          onClick={() => {
            if (canOpenDevtools && onOpenDevtools) {
              onOpenDevtools(message.cycleId);
            }
          }}
        >
          <ExternalLink className="h-4 w-4" />
          View In Devtools
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

interface ChatMessageRowProps {
  message: ProjectedConversationMessage;
  onPreviewAttachment: (assetId: string) => void;
  onOpenDevtools?: (cycleId: number) => void;
}

export const ChatMessageRow = ({ message, onPreviewAttachment, onOpenDevtools }: ChatMessageRowProps) => {
  const alignment = message.role === "user" ? "end" : "start";
  const presentation = resolveChatMessagePresentation({
    role: message.role,
    channel: message.channel,
  });
  const attachments = message.attachments ?? [];
  const hasText = message.content.trim().length > 0;

  return (
    <div
      className={cn("flex w-full px-1 py-1.5", alignment === "end" ? "justify-end" : "justify-start")}
      data-chat-row="message"
      data-chat-align={alignment}
      data-message-id={message.id}
      data-message-role={message.role}
      data-message-channel={message.channel ?? ""}
      data-message-transient={message.transient ? "true" : "false"}
    >
      <article className={cn(rowShellClassName, "relative rounded-2xl px-3 py-2.5 pr-10 text-[13px]", presentation.bubbleClassName)}>
        <MessageActions message={message} onOpenDevtools={onOpenDevtools} />
        <div className="space-y-2">
          {attachments.length > 0 ? <ChatAttachmentStrip attachments={attachments} onPreview={onPreviewAttachment} /> : null}
          {hasText ? (
            message.role === "assistant" ? (
              <AssistantMarkdown content={message.content} channel={message.channel} tool={message.tool} />
            ) : (
              <MarkdownDocument
                value={message.content}
                mode="preview"
                usage="chat"
                surface={presentation.markdownSurface}
                syntaxTone={presentation.syntaxTone}
                className="text-[13px] text-current"
              />
            )
          ) : null}
        </div>
      </article>
    </div>
  );
};

export const StatusRow = ({ row }: { row: Extract<ConversationRow, { type: "status" }> }) => {
  const toneClassName =
    row.tone === "danger"
      ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200"
      : row.tone === "active"
        ? "bg-teal-50 text-teal-700 ring-1 ring-teal-200"
        : "bg-slate-100 text-slate-600";
  const icon =
    row.tone === "danger" ? (
      <AlertTriangle className="h-3.5 w-3.5" />
    ) : row.tone === "active" ? (
      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
    ) : (
      <Sparkles className="h-3.5 w-3.5" />
    );

  return (
    <div className="flex w-full justify-start px-1 py-1" data-chat-row="status">
      <div className={cn(rowShellClassName, "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs", toneClassName)}>
        {icon}
        <span>{row.text}</span>
      </div>
    </div>
  );
};

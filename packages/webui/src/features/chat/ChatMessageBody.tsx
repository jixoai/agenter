import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { ChatAttachmentStrip } from "./ChatAttachmentStrip";
import { resolveChatMessagePresentation } from "./chat-contract";
import type { ProjectedConversationMessage } from "./chat-projection";

interface ChatMessageBodyProps {
  message: ProjectedConversationMessage;
  presentation: ReturnType<typeof resolveChatMessagePresentation>;
  onPreviewAttachment: (assetId: string) => void;
}

export const ChatMessageBody = ({ message, presentation, onPreviewAttachment }: ChatMessageBodyProps) => {
  const attachments = message.attachments ?? [];
  const hasText = message.content.trim().length > 0;

  return (
    <div className="space-y-2">
      {attachments.length > 0 ? (
        <ChatAttachmentStrip attachments={attachments} onPreview={onPreviewAttachment} />
      ) : null}
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
  );
};

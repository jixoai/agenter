import type { WebChatMessage } from "@agenter/web-chat-view";
import { useRef } from "react";

import { ProfileImage } from "../../components/ui/profile-image";
import { DropdownMenu } from "../../components/ui/dropdown-menu";
import { AssistantMarkdown } from "./AssistantMarkdown";
import { ChatMessageActions } from "./chat-message-actions";

interface MessageChannelBubbleProps {
  message: WebChatMessage;
  isAssistant: boolean;
  assistantAvatarUrl?: string | null;
  assistantAvatarLabel?: string;
  userAvatarLabel?: string;
  onOpenDevtools?: (cycleId: number) => void;
}

const resolveCycleId = (message: WebChatMessage): number | null => {
  const metadataCycleId =
    typeof message.metadata?.cycleId === "number" && Number.isInteger(message.metadata.cycleId) && message.metadata.cycleId > 0
      ? message.metadata.cycleId
      : null;
  if (metadataCycleId !== null) {
    return metadataCycleId;
  }

  if (typeof message.rootId === "string") {
    const parsed = Number(message.rootId);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

export const MessageChannelBubble = ({
  message,
  isAssistant,
  assistantAvatarUrl,
  assistantAvatarLabel = "Assistant",
  userAvatarLabel = "You",
  onOpenDevtools,
}: MessageChannelBubbleProps) => {
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cycleId = resolveCycleId(message);

  return (
    <div className={`flex w-full py-1.5 ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className={`flex min-w-0 max-w-full items-end gap-2.5 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}>
        <ProfileImage
          src={isAssistant ? assistantAvatarUrl : null}
          label={isAssistant ? assistantAvatarLabel : userAvatarLabel}
          className="h-8 w-8 shrink-0 rounded-2xl"
        />
        <article
          className={`group relative min-w-0 max-w-[92%] rounded-2xl px-3 py-2.5 pr-10 text-[13px] shadow-xs md:max-w-[44rem] ${isAssistant ? "bg-white text-slate-800 ring-1 ring-slate-200" : "bg-slate-900 text-white"}`}
        >
          <DropdownMenu>
            <ChatMessageActions
              triggerRef={menuTriggerRef}
              onOpenDevtools={onOpenDevtools}
              message={{
                content: message.content,
                role: isAssistant ? "assistant" : "user",
                cycleId,
              }}
            />
          </DropdownMenu>
          <div className={`mb-1 flex items-center gap-2 text-[11px] ${isAssistant ? "text-slate-500" : "text-white/72"}`}>
            <span className="truncate font-medium">{message.from}</span>
            <span>
              {new Intl.DateTimeFormat(undefined, {
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(message.createdAt))}
            </span>
          </div>

          {message.content.trim().length > 0 ? (
            isAssistant ? (
              <AssistantMarkdown content={message.content} />
            ) : (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            )
          ) : null}

          {(message.attachments?.length ?? 0) > 0 ? (
            <ul className={`mt-2 space-y-1 text-[11px] ${isAssistant ? "text-slate-500" : "text-white/78"}`}>
              {message.attachments?.map((attachment) => (
                <li key={attachment.assetId}>
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-dotted underline-offset-2"
                  >
                    {attachment.name}
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </div>
    </div>
  );
};

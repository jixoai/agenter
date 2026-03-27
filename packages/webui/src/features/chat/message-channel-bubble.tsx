import type { WebChatMessage } from "@agenter/web-chat-view";
import { CircleAlert } from "lucide-react";
import { useRef, useState } from "react";

import { MarkdownDocument } from "../../components/markdown/MarkdownDocument";
import { DropdownMenu } from "../../components/ui/dropdown-menu";
import { ProfileImage } from "../../components/ui/profile-image";
import { ChatMessageActions } from "./chat-message-actions";

interface MessageChannelBubbleProps {
  message: WebChatMessage;
  isAssistant: boolean;
  assistantAvatarUrl?: string | null;
  assistantAvatarLabel?: string;
  userAvatarLabel?: string;
  onOpenDevtools?: (cycleId: number) => void;
  onSubmitInteractive: (text: string) => Promise<void>;
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

const buildInteractiveMessage = (message: WebChatMessage, values: Record<string, string>): string => {
  const interactive = message.payload?.interactive;
  if (!interactive) {
    return message.content;
  }
  const lines = interactive.fields
    .map((field) => {
      const value = (values[field.id] ?? field.initialValue ?? "").trim();
      if (value.length === 0) {
        return null;
      }
      return `${field.label}: ${value}`;
    })
    .filter((line): line is string => line !== null);
  if (lines.length === 0) {
    return message.content;
  }
  return `${message.content}\n${lines.join("\n")}`;
};

export const MessageChannelBubble = ({
  message,
  isAssistant,
  assistantAvatarUrl,
  assistantAvatarLabel = "Assistant",
  userAvatarLabel = "You",
  onOpenDevtools,
  onSubmitInteractive,
}: MessageChannelBubbleProps) => {
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const cycleId = resolveCycleId(message);
  const interactive = message.kind === "interactive" ? message.payload?.interactive : undefined;
  const [interactiveValues, setInteractiveValues] = useState<Record<string, string>>({});
  const [interactiveSubmitting, setInteractiveSubmitting] = useState(false);

  const handleInteractiveSubmit = async () => {
    if (!interactive || interactiveSubmitting) {
      return;
    }
    setInteractiveSubmitting(true);
    try {
      await onSubmitInteractive(buildInteractiveMessage(message, interactiveValues));
    } finally {
      setInteractiveSubmitting(false);
    }
  };

  return (
    <div className={`flex w-full py-1.5 ${isAssistant ? "justify-start" : "justify-end"}`}>
      <div className={`flex min-w-0 max-w-full items-end gap-2.5 ${isAssistant ? "flex-row" : "flex-row-reverse"}`}>
        <ProfileImage
          src={isAssistant ? assistantAvatarUrl : null}
          label={isAssistant ? assistantAvatarLabel : userAvatarLabel}
          className="h-8 w-8 shrink-0 rounded-2xl"
        />
        <article
          className={`group relative min-w-0 max-w-[92%] rounded-2xl px-3 py-2.5 pr-10 text-[13px] shadow-xs md:max-w-[44rem] ${
            message.kind === "error"
              ? "border border-rose-200 bg-rose-50 text-rose-900"
              : isAssistant
                ? "bg-white text-slate-800 ring-1 ring-slate-200"
                : "bg-slate-900 text-white"
          }`}
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

          {message.kind === "error" ? (
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
                <CircleAlert className="h-3.5 w-3.5" />
                {message.payload?.error?.title ?? "Error"}
              </div>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
              {message.payload?.error?.detail ? (
                <p className="whitespace-pre-wrap break-words text-xs text-rose-700">{message.payload.error.detail}</p>
              ) : null}
            </div>
          ) : message.kind === "interactive" && interactive ? (
            <div className="space-y-2.5">
              <p className="font-medium text-slate-900">{interactive.title}</p>
              {interactive.description ? <p className="text-xs text-slate-600">{interactive.description}</p> : null}
              <div className="space-y-2">
                {interactive.fields.map((field) => {
                  const value = interactiveValues[field.id] ?? field.initialValue ?? "";
                  return (
                    <label key={field.id} className="block space-y-1 text-xs text-slate-700">
                      <span className="font-medium">{field.label}</span>
                      {field.multiline ? (
                        <textarea
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setInteractiveValues((current) => ({
                              ...current,
                              [field.id]: event.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-500"
                          rows={3}
                        />
                      ) : (
                        <input
                          value={value}
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            setInteractiveValues((current) => ({
                              ...current,
                              [field.id]: event.target.value,
                            }))
                          }
                          className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-500"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
              <button
                type="button"
                className="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs font-medium text-white disabled:opacity-50"
                onClick={handleInteractiveSubmit}
                disabled={interactiveSubmitting}
              >
                {interactiveSubmitting ? "Sending..." : interactive.submitLabel ?? "Submit"}
              </button>
            </div>
          ) : message.content.trim().length > 0 ? (
            isAssistant ? (
              <MarkdownDocument value={message.content} mode="preview" usage="chat" className="text-[13px] text-current" />
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

import { Copy, Ellipsis, ExternalLink } from "lucide-react";
import type { RefObject } from "react";

import { DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../components/ui/dropdown-menu";
import { cn } from "../../lib/utils";
import type { ProjectedConversationMessage } from "./chat-projection";

export const markdownToPlainText = (value: string): string =>
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

interface ChatMessageActionsProps {
  message: ProjectedConversationMessage;
  onOpenDevtools?: (cycleId: number) => void;
  triggerRef?: RefObject<HTMLButtonElement | null>;
}

export const ChatMessageActions = ({ message, onOpenDevtools, triggerRef }: ChatMessageActionsProps) => {
  const cycleId = typeof message.cycleId === "number" && Number.isFinite(message.cycleId) ? message.cycleId : null;
  const canOpenDevtools = cycleId !== null;
  const triggerClassName =
    message.role === "user" ? "text-white/82 hover:bg-white/12" : "text-slate-500 hover:bg-slate-100";

  return (
    <>
      <DropdownMenuTrigger
        ref={triggerRef}
        aria-label="Message actions"
        title="Message actions"
        data-message-actions-trigger="true"
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
            if (cycleId !== null && onOpenDevtools) {
              onOpenDevtools(cycleId);
            }
          }}
        >
          <ExternalLink className="h-4 w-4" />
          View In Devtools
        </DropdownMenuItem>
      </DropdownMenuContent>
    </>
  );
};

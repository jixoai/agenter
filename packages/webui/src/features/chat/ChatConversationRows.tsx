import { AlertTriangle, LoaderCircle, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { DropdownMenu } from "../../components/ui/dropdown-menu";
import { ProfileImage } from "../../components/ui/profile-image";
import { cn } from "../../lib/utils";
import { ChatMessageBody } from "./ChatMessageBody";
import { resolveChatMessagePresentation } from "./chat-contract";
import { ChatMessageActions } from "./chat-message-actions";
import type { ConversationRow, ProjectedConversationMessage } from "./chat-projection";

const rowShellClassName = "group w-fit max-w-[92%] md:max-w-[44rem]";
const LONG_PRESS_OPEN_DELAY_MS = 420;
const LONG_PRESS_MOVE_THRESHOLD_PX = 10;

interface ChatMessageRowProps {
  message: ProjectedConversationMessage;
  assistantAvatarUrl?: string | null;
  assistantAvatarLabel?: string;
  userAvatarLabel?: string;
  onPreviewAttachment: (assetId: string) => void;
  onOpenDevtools?: (cycleId: number) => void;
}

export const ChatMessageRow = ({
  message,
  assistantAvatarUrl,
  assistantAvatarLabel = "Assistant",
  userAvatarLabel = "You",
  onPreviewAttachment,
  onOpenDevtools,
}: ChatMessageRowProps) => {
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const suppressClickUntilRef = useRef(0);
  const [longPressPending, setLongPressPending] = useState(false);
  const alignment = message.role === "user" ? "end" : "start";
  const presentation = resolveChatMessagePresentation({
    role: message.role,
    channel: message.channel,
  });

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
    setLongPressPending(false);
  }, []);

  const openMessageActions = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + LONG_PRESS_OPEN_DELAY_MS;
    setLongPressPending(false);
    menuTriggerRef.current?.focus({ preventScroll: true });
    menuTriggerRef.current?.click();
  }, []);

  useEffect(() => clearLongPress, [clearLongPress]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if ((event.target as HTMLElement).closest("[data-message-actions-trigger='true']")) {
        return;
      }
      if (event.pointerType !== "touch" && event.pointerType !== "pen") {
        return;
      }
      clearLongPress();
      suppressClickUntilRef.current = 0;
      longPressStartRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      setLongPressPending(true);
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        longPressStartRef.current = null;
        openMessageActions();
      }, LONG_PRESS_OPEN_DELAY_MS);
    },
    [clearLongPress, openMessageActions],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const pointerStart = longPressStartRef.current;
      if (!pointerStart || pointerStart.pointerId !== event.pointerId) {
        return;
      }
      if (
        Math.abs(event.clientX - pointerStart.x) > LONG_PRESS_MOVE_THRESHOLD_PX ||
        Math.abs(event.clientY - pointerStart.y) > LONG_PRESS_MOVE_THRESHOLD_PX
      ) {
        clearLongPress();
      }
    },
    [clearLongPress],
  );

  const handlePointerRelease = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  return (
    <div
      className={cn("flex w-full py-1.5", alignment === "end" ? "justify-end" : "justify-start")}
      data-chat-row="message"
      data-chat-align={alignment}
      data-message-id={message.id}
      data-message-role={message.role}
      data-message-channel={message.channel ?? ""}
      data-message-transient={message.transient ? "true" : "false"}
    >
      <div className={cn("flex max-w-full items-end gap-2.5", alignment === "end" ? "flex-row-reverse" : "flex-row")}>
        <ProfileImage
          src={message.role === "assistant" ? assistantAvatarUrl : null}
          label={message.role === "assistant" ? assistantAvatarLabel : userAvatarLabel}
          className="h-8 w-8 shrink-0 rounded-2xl"
        />
        <article
          data-chat-bubble="true"
          className={cn(
            rowShellClassName,
            "relative rounded-2xl px-3 py-2.5 pr-10 text-[13px] transition-shadow",
            presentation.bubbleClassName,
            longPressPending ? "ring-2 ring-teal-200/70" : "",
          )}
          onClickCapture={(event) => {
            if ((event.target as HTMLElement).closest("[data-message-actions-trigger='true']")) {
              return;
            }
            if (Date.now() > suppressClickUntilRef.current) {
              return;
            }
            suppressClickUntilRef.current = 0;
            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerRelease}
          onPointerCancel={handlePointerRelease}
          onPointerLeave={handlePointerRelease}
          onContextMenu={(event) => {
            event.preventDefault();
            clearLongPress();
            menuTriggerRef.current?.focus({ preventScroll: true });
            menuTriggerRef.current?.click();
          }}
        >
          <DropdownMenu>
            <ChatMessageActions message={message} onOpenDevtools={onOpenDevtools} triggerRef={menuTriggerRef} />
          </DropdownMenu>
          <ChatMessageBody message={message} presentation={presentation} onPreviewAttachment={onPreviewAttachment} />
        </article>
      </div>
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
    <div className="flex w-full justify-start py-1" data-chat-row="status">
      <div
        className={cn(
          rowShellClassName,
          "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs",
          toneClassName,
        )}
      >
        {icon}
        <span>{row.text}</span>
      </div>
    </div>
  );
};

export const TimeDividerRow = ({ row }: { row: Extract<ConversationRow, { type: "time-divider" }> }) => (
  <div className="flex w-full items-center justify-center py-3" data-chat-row="time-divider">
    <div className="flex min-w-0 items-center gap-3 text-[11px] text-slate-400">
      <span className="h-px w-8 bg-slate-200" />
      <span
        className={cn("tracking-[0.08em]", row.emphasis === "date" ? "font-semibold text-slate-500 uppercase" : "")}
      >
        {row.label}
      </span>
      <span className="h-px w-8 bg-slate-200" />
    </div>
  </div>
);

import type { TextareaRenderable } from "@opentui/core";
import { useEffect, useMemo, useState, type RefObject } from "react";

import type { ChatMessage } from "../../core/protocol";
import { AssistantMarkdown } from "../components/AssistantMarkdown";

interface ChatPanelProps {
  messages: ChatMessage[];
  aiStatus: string | null;
  inputRef: RefObject<TextareaRenderable | null>;
  onInputChange: () => void;
  onSubmit: () => void;
  focused: boolean;
}

const TEXTAREA_KEY_BINDINGS = [
  { name: "return", action: "submit" as const },
  { name: "linefeed", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
  { name: "linefeed", shift: true, action: "newline" as const },
];

type DisplayItem =
  | { kind: "message"; message: ChatMessage }
  | {
      kind: "tool";
      id: string;
      toolName: string;
      status: "waiting" | "running" | "success" | "failed" | "cancelled";
      message: ChatMessage;
    };

const buildDisplayItems = (messages: ChatMessage[]): DisplayItem[] => {
  const items: DisplayItem[] = [];
  for (const current of messages) {
    if (!current || current.content.trim().length === 0) {
      continue;
    }
    if (current.channel === "tool") {
      items.push({
        kind: "tool",
        id: current.id,
        toolName: current.tool?.name ?? "unknown",
        status: current.tool?.status ?? "running",
        message: current,
      });
      continue;
    }
    items.push({
      kind: "message",
      message: current,
    });
  }
  return items;
};

export const ChatPanel = ({ messages, aiStatus, inputRef, onInputChange, onSubmit, focused }: ChatPanelProps) => {
  const title = focused ? "chat *" : "chat";
  const recent = messages.slice(-120).filter((item) => item.content.trim().length > 0);
  const displayItems = useMemo(() => buildDisplayItems(recent), [recent]);
  const [expandedToolIds, setExpandedToolIds] = useState<Record<string, boolean>>({});
  const [spinnerTick, setSpinnerTick] = useState(0);

  const hasPendingTool = displayItems.some(
    (item) => item.kind === "tool" && (item.status === "waiting" || item.status === "running"),
  );

  useEffect(() => {
    if (!hasPendingTool) {
      return;
    }
    const timer = setInterval(() => {
      setSpinnerTick((value) => value + 1);
    }, 150);
    return () => clearInterval(timer);
  }, [hasPendingTool]);

  const getBubbleBg = (item: ChatMessage): string | undefined => {
    if (item.role === "user") {
      return "blue";
    }
    if (item.channel === "self_talk") {
      return "black";
    }
    return undefined;
  };

  const getBubbleFg = (item: ChatMessage): string => {
    if (item.role === "user") {
      return "white";
    }
    if (item.channel === "self_talk") {
      return "white";
    }
    return "green";
  };

  const getRoleLabel = (item: ChatMessage): string => {
    if (item.role === "user") {
      return "🧑 you";
    }
    if (item.channel === "self_talk") {
      return "🧠 self-talk";
    }
    return "🤖 assistant";
  };

  const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

  return (
    <box
      border
      borderColor={focused ? "cyan" : "gray"}
      flexDirection="column"
      padding={1}
      width="40%"
      height="100%"
      title={title}
    >
      <scrollbox flexGrow={2} stickyScroll stickyStart="bottom">
        <box flexDirection="column">
          {displayItems.length === 0 ? (
            <text fg="gray">(no messages)</text>
          ) : (
            displayItems.map((item) => {
              if (item.kind === "tool") {
                const expanded = expandedToolIds[item.id] === true;
                const isPending = item.status === "waiting" || item.status === "running";
                const statusIcon = isPending
                  ? SPINNER_FRAMES[spinnerTick % SPINNER_FRAMES.length]
                  : item.status === "success"
                    ? "✅"
                    : item.status === "failed"
                      ? "❌"
                      : item.status === "cancelled"
                        ? "⏹"
                        : "•";
                const statusText =
                  item.status === "success"
                    ? "success"
                    : item.status === "failed"
                      ? "failed"
                      : item.status === "cancelled"
                        ? "cancelled"
                        : item.status;
                const statusFg = isPending ? "yellow" : item.status === "success" ? "green" : "red";
                return (
                  <box key={item.id} marginTop={0} width="100%" flexDirection="column">
                    <box
                      flexDirection="row"
                      justifyContent="space-between"
                      onMouseDown={() =>
                        setExpandedToolIds((prev) => ({
                          ...prev,
                          [item.id]: !prev[item.id],
                        }))
                      }
                      maxWidth="78%"
                      alignSelf="flex-start"
                      padding={0}
                      backgroundColor="black"
                    >
                      <text fg="cyan">🛠️ {item.toolName}</text>
                      <text fg={statusFg}>
                        {statusIcon} {statusText}
                      </text>
                    </box>
                    {expanded ? (
                      <box flexDirection="column" maxWidth="78%" alignSelf="flex-start" padding={0} marginTop={1}>
                        <AssistantMarkdown message={item.message} />
                      </box>
                    ) : null}
                  </box>
                );
              }

              const message = item.message;
              return (
                <box key={message.id} marginTop={1} width="100%" flexDirection="column">
                  <box
                    flexDirection="column"
                    maxWidth="78%"
                    alignSelf={message.role === "user" ? "flex-end" : "flex-start"}
                    padding={1}
                    backgroundColor={getBubbleBg(message)}
                  >
                    <text fg={getBubbleFg(message)}>{getRoleLabel(message)}</text>
                    {message.role === "assistant" ? (
                      <AssistantMarkdown message={message} />
                    ) : (
                      <text fg={getBubbleFg(message)}>{message.content}</text>
                    )}
                  </box>
                </box>
              );
            })
          )}
        </box>
      </scrollbox>
      {aiStatus ? (
        <box marginTop={1} paddingLeft={1}>
          <text fg="yellow">AI: {aiStatus}</text>
        </box>
      ) : null}
      <box flexGrow={0} flexBasis={6} flexDirection="row" marginTop={1} alignItems="stretch">
        <box border borderColor={focused ? "cyan" : "gray"} width="86%" minHeight={5}>
          <textarea
            ref={inputRef}
            onContentChange={onInputChange}
            onSubmit={onSubmit}
            keyBindings={TEXTAREA_KEY_BINDINGS}
            placeholder="Enter 发送，Shift+Enter 换行"
            selectionBg="cyan"
            selectionFg="black"
            wrapMode="word"
            width="100%"
            height={3}
            focused={focused}
          />
        </box>
        <box
          marginLeft={1}
          padding={1}
          justifyContent="center"
          onMouseDown={onSubmit}
          minWidth={8}
          backgroundColor={focused ? "cyan" : "gray"}
        >
          <text fg="black">Send</text>
        </box>
      </box>
    </box>
  );
};

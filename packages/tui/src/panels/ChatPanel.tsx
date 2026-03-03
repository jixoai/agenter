import type { RefObject } from "react";
import type { TextareaRenderable } from "@opentui/core";

interface ChatPanelProps {
  activeInstanceId: string | null;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
  inputRef: RefObject<TextareaRenderable | null>;
  focused: boolean;
  onInputChange: () => void;
  onSubmit: () => void;
}

const KEY_BINDINGS = [
  { name: "return", action: "submit" as const },
  { name: "linefeed", action: "submit" as const },
  { name: "return", shift: true, action: "newline" as const },
  { name: "linefeed", shift: true, action: "newline" as const },
];

export const ChatPanel = ({ activeInstanceId, messages, inputRef, focused, onInputChange, onSubmit }: ChatPanelProps) => {
  return (
    <box border borderColor={focused ? "cyan" : "gray"} padding={1} flexGrow={1} flexDirection="column" title="chat">
      <text fg="gray">active: {activeInstanceId ?? "none"}</text>
      <scrollbox flexGrow={1} stickyScroll stickyStart="bottom">
        <box flexDirection="column">
          {messages.length === 0 ? <text fg="gray">(no messages)</text> : null}
          {messages.map((message) => (
            <box key={message.id} marginTop={1} alignSelf={message.role === "user" ? "flex-end" : "flex-start"} maxWidth="85%">
              <box
                padding={1}
                backgroundColor={message.role === "user" ? "blue" : "black"}
                border
                borderColor={message.role === "user" ? "blue" : "gray"}
              >
                <text fg="white">{message.role === "user" ? "you" : "assistant"}: {message.content}</text>
              </box>
            </box>
          ))}
        </box>
      </scrollbox>

      <box marginTop={1} flexDirection="row" alignItems="stretch">
        <box border borderColor={focused ? "cyan" : "gray"} flexGrow={1}>
          <textarea
            ref={inputRef}
            onContentChange={onInputChange}
            onSubmit={onSubmit}
            keyBindings={KEY_BINDINGS}
            placeholder="Enter send / Shift+Enter newline"
            wrapMode="word"
            width="100%"
            height={3}
            focused={focused}
          />
        </box>
        <box marginLeft={1} padding={1} backgroundColor={focused ? "cyan" : "gray"} onMouseDown={onSubmit} justifyContent="center">
          <text fg="black">Send</text>
        </box>
      </box>
    </box>
  );
};

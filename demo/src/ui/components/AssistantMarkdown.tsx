import { SyntaxStyle } from "@opentui/core";
import { useMemo, useState } from "react";

import type { ChatMessage } from "../../core/protocol";

interface AssistantMarkdownProps {
  message: ChatMessage;
}

type ToolFenceKind = "tool_call" | "tool_result";

interface ParsedToolFence {
  kind: ToolFenceKind;
  lang: string;
  body: string;
  summary: string;
}

const TOOL_FENCE_PATTERN = /^```([^\n]+)\n([\s\S]*?)\n```$/;

const parseToolFence = (content: string): ParsedToolFence | null => {
  const match = TOOL_FENCE_PATTERN.exec(content.trim());
  if (!match) {
    return null;
  }
  const lang = match[1].trim().toLowerCase();
  const body = match[2].trim();
  const kind = lang.endsWith("+tool_call") ? "tool_call" : lang.endsWith("+tool_result") ? "tool_result" : null;
  if (!kind) {
    return null;
  }

  const toolNameMatch = /^tool:\s*(.+)$/m.exec(body);
  const toolName = toolNameMatch?.[1]?.trim() || "unknown";
  const statusMatch = /^ok:\s*(.+)$/m.exec(body);
  const okText = statusMatch?.[1]?.trim();
  const statusText =
    kind === "tool_result" ? ` ${okText === "true" ? "ok" : okText === "false" ? "failed" : "result"}` : "";
  return {
    kind,
    lang,
    body,
    summary: `${kind === "tool_call" ? "tool call" : "tool result"}: ${toolName}${statusText}`,
  };
};

const MARKDOWN_STYLE = SyntaxStyle.create();

export const AssistantMarkdown = ({ message }: AssistantMarkdownProps) => {
  if (message.content.trim().length === 0) {
    return null;
  }

  const [expanded, setExpanded] = useState(false);
  const parsed = useMemo(() => parseToolFence(message.content), [message.content]);
  const headerColor = message.channel === "tool_result" ? "magenta" : "cyan";

  if (parsed) {
    return (
      <box flexDirection="column">
        <box onMouseDown={() => setExpanded((prev) => !prev)}>
          <text fg={headerColor}>
            {expanded ? "▼" : "▶"} {parsed.summary}
          </text>
        </box>
        {expanded ? (
          <box marginTop={1}>
            <markdown
              content={message.content}
              syntaxStyle={MARKDOWN_STYLE}
              renderNode={(_token, context) => context.defaultRender()}
            />
          </box>
        ) : null}
      </box>
    );
  }

  return (
    <markdown
      content={message.content}
      syntaxStyle={MARKDOWN_STYLE}
      renderNode={(_token, context) => context.defaultRender()}
    />
  );
};

import { SyntaxStyle } from "@opentui/core";
import { useMemo, useState } from "react";

import type { ChatMessage } from "../../core/protocol";

interface AssistantMarkdownProps {
  message: ChatMessage;
}

interface ParsedToolFence {
  kind: "tool";
  lang: string;
  body: string;
  status: string;
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
  if (!lang.includes("yaml")) {
    return null;
  }

  const toolNameMatch = /^tool:\s*(.+)$/m.exec(body);
  const toolName = toolNameMatch?.[1]?.trim() || "unknown";
  const statusMatch = /^status:\s*(.+)$/m.exec(body);
  const status = statusMatch?.[1]?.trim().toLowerCase() || "running";
  return {
    kind: "tool",
    lang,
    body,
    status,
    summary: `tool: ${toolName} ${status}`,
  };
};

const MARKDOWN_STYLE = SyntaxStyle.create();

export const AssistantMarkdown = ({ message }: AssistantMarkdownProps) => {
  if (message.content.trim().length === 0) {
    return null;
  }

  const [expanded, setExpanded] = useState(false);
  const parsed = useMemo(() => parseToolFence(message.content), [message.content]);
  const headerColor = parsed?.status === "failed" ? "magenta" : "cyan";

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

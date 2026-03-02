import type { RefObject } from "react";
import type { TextRenderable } from "@opentui/core";

import type { DebugLogLine } from "../../core/protocol";

interface DebugLogPanelProps {
  logs: DebugLogLine[];
  focused: boolean;
  scrollOffset: number;
  contentRef: RefObject<TextRenderable | null>;
}

const formatMeta = (line: DebugLogLine): string => {
  if (!line.meta) {
    return "";
  }
  const parts = Object.entries(line.meta).map(
    ([key, value]) => `${key}=${String(value)}`,
  );
  return parts.length > 0 ? ` | ${parts.join(" ")}` : "";
};

const formatLine = (line: DebugLogLine): string => {
  const time = new Date(line.timestamp).toISOString().slice(11, 23);
  return `${time} [${line.channel}/${line.level}] ${line.message}${formatMeta(line)}`;
};

export const DebugLogPanel = ({
  logs,
  focused,
  scrollOffset,
  contentRef,
}: DebugLogPanelProps) => {
  const title = focused ? "debug-log *" : "debug-log";
  const loopKeywords = new Set([
    "loopbus.push",
    "loopbus.push.merge",
    "loopbus.pop",
    "loopbus.pop.skip",
    "loopbus.response",
    "loopbus.tool.result",
    "loopbus.user.dispatch",
    "loopbus.terminal.dispatch",
    "ai.response",
    "ai.skip",
    "decision.received",
  ]);

  const terminalKeywords = new Set([
    "terminal.dirty.mark",
    "terminal.dirty.release",
    "terminal.sliceDirty",
    "terminal.markDirty",
    "terminal.dirty.slice",
    "command.prepare",
    "command.write",
    "command.submit",
    "command.done",
    "frame updated",
    "pty data",
  ]);

  const systemChannels = new Set(["ui", "error"]);
  const take = 7;
  const shift = Math.max(0, scrollOffset);
  const windowed = (lines: DebugLogLine[]): DebugLogLine[] => {
    const end = Math.max(0, lines.length - shift);
    const start = Math.max(0, end - take);
    return lines.slice(start, end);
  };

  const loopLines = windowed(
    logs.filter((line) => loopKeywords.has(line.message)),
  );
  const terminalLines = windowed(
    logs.filter((line) => terminalKeywords.has(line.message)),
  );
  const systemLines = windowed(
    logs.filter(
      (line) =>
        systemChannels.has(line.channel) ||
        (!loopKeywords.has(line.message) &&
          !terminalKeywords.has(line.message)),
    ),
  );

  const toBlock = (lines: DebugLogLine[]): string => {
    const body =
      lines.length === 0
        ? "(no logs)"
        : lines.map((line) => formatLine(line)).join("\n");
    return body;
  };

  return (
    <box
      border
      borderColor={focused ? "cyan" : "gray"}
      padding={1}
      flexDirection="column"
      height={14}
      title={title}
    >
      <box flexDirection="row" flexGrow={1}>
        <scrollbox
          flexGrow={1}
          border
          borderColor={focused ? "cyan" : "gray"}
          padding={1}
          title="loopbus/ai"
        >
          <text ref={contentRef} selectable>
            {toBlock(loopLines)}
          </text>
        </scrollbox>
        <scrollbox
          flexGrow={1}
          marginLeft={1}
          border
          borderColor={focused ? "cyan" : "gray"}
          padding={1}
          title="terminal/runtime"
        >
          <text selectable>{toBlock(terminalLines)}</text>
        </scrollbox>
        <scrollbox
          flexGrow={1}
          marginLeft={1}
          border
          borderColor={focused ? "cyan" : "gray"}
          padding={1}
          title="system/misc"
        >
          <text selectable>{toBlock(systemLines)}</text>
        </scrollbox>
      </box>
    </box>
  );
};

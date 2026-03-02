import type { DebugLogLine, TerminalSnapshot } from "../core/protocol";

export const summarizeState = (input: {
  snapshot: TerminalSnapshot;
  logs: DebugLogLine[];
}): string => {
  const lastLines = input.snapshot.lines.slice(-6).filter((line) => line.trim().length > 0);
  const events = input.logs.slice(-5).map((log) => `${log.channel}:${log.message}`).join(" | ");

  const terminalSummary = lastLines.length > 0 ? lastLines.join("\n") : "(终端暂无可见输出)";
  const eventSummary = events.length > 0 ? events : "(暂无日志事件)";

  return `终端摘要:\n${terminalSummary}\n\n最近事件:\n${eventSummary}`;
};

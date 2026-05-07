import type { RuntimeClientState } from "@agenter/client-sdk";

import { resolveCliShellToolbarStatus, resolveCliShellToolbarStatusIcon, summarizeCliShellHeartbeat } from "./heartbeat";

export interface CliShellCollapsedModel {
  bodyLines: string[];
  toolbarHeartbeat: string;
  toolbarLeft: string;
  toolbarManaged: string;
  toolbarUnread: string;
}

const resolveTerminalId = (input: {
  state: RuntimeClientState;
  sessionId: string;
  fallbackTerminalId: string;
}): string => {
  const runtime = input.state.runtimes[input.sessionId];
  return runtime?.focusedTerminalId?.trim() || input.fallbackTerminalId;
};

export const buildCliShellCollapsedModel = (input: {
  state: RuntimeClientState;
  sessionId: string;
  shellName: string;
  fallbackTerminalId: string;
  managed: boolean;
}): CliShellCollapsedModel => {
  const terminalId = resolveTerminalId(input);
  const terminalSnapshot =
    input.state.terminalSnapshotsBySession[input.sessionId]?.[terminalId] ??
    input.state.runtimes[input.sessionId]?.terminalSnapshots?.[terminalId];
  const heartbeatGroups = input.state.heartbeatGroupsBySession[input.sessionId]?.data ?? [];
  const status = resolveCliShellToolbarStatus(heartbeatGroups);
  const unread = input.state.unreadBySession[input.sessionId] ?? 0;
  const terminalLines =
    terminalSnapshot?.lines.length && terminalSnapshot.lines.some((line) => line.length > 0)
      ? terminalSnapshot.lines
      : [`${terminalId || input.shellName}: waiting for terminal snapshot`];

  return {
    bodyLines: terminalLines,
    toolbarLeft: `${resolveCliShellToolbarStatusIcon(status)} terminal`,
    toolbarHeartbeat: summarizeCliShellHeartbeat({
      groups: heartbeatGroups,
      terminalId: terminalId || input.shellName,
      connected: input.state.connected,
    }),
    toolbarManaged: `托管 ${input.managed ? "on" : "off"}`,
    toolbarUnread: `✉ ${unread} ⌘J`,
  };
};

import type { TmuxPane, TmuxSession } from "./types";

export const TMUX_FIELD_SEPARATOR = "\u001f";

export const quoteShellArg = (value: string): string => `'${value.replace(/'/g, "'\\''")}'`;

export const toShellCommand = (command: string | readonly string[] | undefined): string | undefined => {
  if (command === undefined) {
    return undefined;
  }
  if (typeof command === "string") {
    return command;
  }
  return command.map(quoteShellArg).join(" ");
};

export const stripSingleTrailingNewline = (value: string): string => value.replace(/\r?\n$/, "");

export const paneListFormat = [
  "#{pane_id}",
  "#{session_name}",
  "#{window_id}",
  "#{window_index}",
  "#{pane_index}",
  "#{pane_active}",
  "#{pane_current_command}",
  "#{pane_start_command}",
  "#{pane_current_path}",
  "#{pane_title}",
].join(TMUX_FIELD_SEPARATOR);

export const sessionListFormat = [
  "#{session_name}",
  "#{session_windows}",
  "#{session_attached}",
  "#{session_created}",
].join(TMUX_FIELD_SEPARATOR);

const parseInteger = (value: string, fallback = 0): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseTmuxPaneList = (stdout: string): TmuxPane[] =>
  stdout
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const [
        paneId = "",
        sessionName = "",
        windowId = "",
        windowIndex = "0",
        paneIndex = "0",
        active = "0",
        currentCommand = "",
        startCommand = "",
        currentPath = "",
        title = "",
      ] = line.split(TMUX_FIELD_SEPARATOR);
      return {
        paneId,
        sessionName,
        windowId,
        windowIndex: parseInteger(windowIndex),
        paneIndex: parseInteger(paneIndex),
        active: active === "1",
        currentCommand,
        startCommand,
        currentPath,
        title,
      };
    });

export const parseTmuxSessionList = (stdout: string): TmuxSession[] =>
  stdout
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => {
      const [sessionName = "", windows = "0", attached = "0", createdAt = "0"] = line.split(TMUX_FIELD_SEPARATOR);
      return {
        sessionName,
        windows: parseInteger(windows),
        attached: attached === "1",
        createdAt: parseInteger(createdAt),
      };
    });

import { parseColor, StyledText, type TextChunk } from "@opentui/core";
import { stringWidth } from "bun";

import { padShellRoomText } from "../app-room/room-model";
import type {
  ShellNavigationRenderedLine,
  ShellNavigationRenderedRow,
  ShellNavigationShellItem,
  ShellNavigationTerminalRowFields,
} from "./navigation-model";

interface TerminalRowField {
  readonly text: string;
  readonly fg: string;
}

const chunk = (text: string, fg: string): TextChunk => ({
  __isChunk: true,
  text,
  fg: parseColor(fg),
});

const styledRow = (chunks: TextChunk[]): StyledText => new StyledText(chunks);

const toChars = (text: string): string[] => Array.from(text);

export const clipShellNavigationFieldToWidth = (text: string, width: number): string => {
  const safeWidth = Math.max(0, Math.trunc(width));
  if (safeWidth === 0) {
    return "";
  }
  if (stringWidth(text) <= safeWidth) {
    return text;
  }
  const ellipsis = "...";
  const ellipsisWidth = stringWidth(ellipsis);
  if (safeWidth <= ellipsisWidth) {
    return ".".repeat(safeWidth);
  }
  const bodyWidth = safeWidth - ellipsisWidth;
  let output = "";
  let used = 0;
  for (const char of toChars(text)) {
    const charWidth = Math.max(1, stringWidth(char));
    if (used + charWidth > bodyWidth) {
      break;
    }
    output += char;
    used += charWidth;
  }
  return `${output}${ellipsis}`;
};

const terminalRowFields = (fields: ShellNavigationTerminalRowFields, width: number): TerminalRowField[] =>
  [
    { text: fields.id, fg: "#38bdf8" },
    { text: fields.pwd, fg: "#94a3b8" },
    { text: fields.title, fg: "#f8fafc" },
    ...(fields.people ? [{ text: fields.people, fg: "#a78bfa" }] : []),
  ]
    .map((field) => ({
      ...field,
      text: clipShellNavigationFieldToWidth(field.text, width),
    }))
    .filter((field) => field.text.length > 0);

const terminalRowLines = (fields: ShellNavigationTerminalRowFields, width: number): ShellNavigationRenderedLine[] => {
  const safeWidth = Math.max(1, Math.trunc(width));
  const separator = "  ";
  const separatorWidth = stringWidth(separator);
  const lines: ShellNavigationRenderedLine[] = [];
  let chunks: TextChunk[] = [];
  let used = 0;

  const flush = () => {
    if (chunks.length === 0) {
      return;
    }
    const plainText = chunks.map((item) => item.text).join("");
    lines.push({ plainText, content: styledRow(chunks) });
    chunks = [];
    used = 0;
  };

  for (const field of terminalRowFields(fields, safeWidth)) {
    const fieldWidth = stringWidth(field.text);
    const needsSeparator = chunks.length > 0;
    const nextWidth = used + (needsSeparator ? separatorWidth : 0) + fieldWidth;
    if (needsSeparator && nextWidth > safeWidth) {
      flush();
    }
    if (chunks.length > 0) {
      chunks.push(chunk(separator, "#64748b"));
      used += separatorWidth;
    }
    chunks.push(chunk(field.text, field.fg));
    used += fieldWidth;
  }
  flush();

  return lines.length > 0 ? lines : [{ plainText: "", content: "" }];
};

export const buildShellNavigationTerminalRow = (
  item: ShellNavigationShellItem,
  width: number,
): ShellNavigationRenderedRow => {
  if (item.kind === "new-shell") {
    const plainText = `+ ${item.title} (${item.shellName})`;
    const content = padShellRoomText(plainText, width);
    return { plainText, lines: [{ plainText, content }] };
  }
  const lines = terminalRowLines(item.rowFields, width);
  return {
    plainText: lines.map((line) => line.plainText).join("\n"),
    lines,
  };
};

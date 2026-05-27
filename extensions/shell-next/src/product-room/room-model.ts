import type { GlobalRoomMessage } from "@agenter/client-sdk";
import { parseColor, StyledText, type TextChunk } from "@opentui/core";

export interface ShellNextRoomRenderRow {
  key: string;
  plainText: string;
  content: string | StyledText;
}

const DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const measure = (text: string): number => Bun.stringWidth(text);

const toChars = (text: string): string[] => Array.from(text);

const clipText = (text: string, width: number): string => {
  const safeWidth = Math.max(0, Math.trunc(width));
  if (safeWidth === 0) {
    return "";
  }
  let output = "";
  let used = 0;
  for (const char of toChars(text)) {
    const charWidth = Math.max(1, measure(char));
    if (used + charWidth > safeWidth) {
      break;
    }
    output += char;
    used += charWidth;
  }
  return output;
};

export const padShellNextRoomText = (text: string, width: number): string => {
  const clipped = clipText(text, width);
  return `${clipped}${" ".repeat(Math.max(0, Math.trunc(width) - measure(clipped)))}`;
};

export const wrapShellNextRoomText = (input: { text: string; width: number; prefix?: string }): string[] => {
  const width = Math.max(1, Math.trunc(input.width));
  const prefix = input.prefix ?? "";
  const bodyWidth = Math.max(1, width - measure(prefix));
  const rows: string[] = [];

  for (const sourceLine of input.text.split(/\r?\n/u)) {
    let line = "";
    let used = 0;
    const flush = () => {
      rows.push(`${prefix}${line}`);
      line = "";
      used = 0;
    };
    for (const char of toChars(sourceLine)) {
      const charWidth = Math.max(1, measure(char));
      if (used > 0 && used + charWidth > bodyWidth) {
        flush();
      }
      if (charWidth <= bodyWidth) {
        line += char;
        used += charWidth;
      }
    }
    flush();
  }

  return rows.length > 0 ? rows : [prefix];
};

const chunk = (input: { text: string; fg?: string; bg?: string }): TextChunk => ({
  __isChunk: true,
  text: input.text,
  fg: input.fg ? parseColor(input.fg) : undefined,
  bg: input.bg ? parseColor(input.bg) : undefined,
});

const styled = (chunks: TextChunk[]): StyledText => new StyledText(chunks);

const messageBody = (message: GlobalRoomMessage): string => {
  if (message.recalledAt) {
    return "_message recalled_";
  }
  const content = message.content.trim();
  if (content.length > 0) {
    return content;
  }
  const attachmentCount = message.attachments?.length ?? 0;
  return attachmentCount > 0 ? `[${attachmentCount} attachments]` : "(empty message)";
};

const authorLabel = (message: GlobalRoomMessage, avatarActorId: string): string => {
  if (message.senderActorId !== avatarActorId) {
    return "you";
  }
  const from = message.from.trim();
  return from.startsWith("@") ? from : `@${from}`;
};

export const buildShellNextRoomRows = (input: {
  messages: readonly GlobalRoomMessage[];
  avatarActorId: string;
  width: number;
}): ShellNextRoomRenderRow[] => {
  const rows: ShellNextRoomRenderRow[] = [];
  let previousDate: string | null = null;

  for (const message of input.messages) {
    const dateLabel = DATE_FORMAT.format(message.createdAt);
    if (dateLabel !== previousDate) {
      const text = `──────── ${dateLabel} ────────`;
      rows.push({
        key: `date:${dateLabel}`,
        plainText: text,
        content: styled([chunk({ text, fg: "#94a3b8" })]),
      });
      previousDate = dateLabel;
    }

    const label = authorLabel(message, input.avatarActorId);
    const authoredByUser = label === "you";
    const prefix = authoredByUser ? ">  " : "";
    const wrapped = wrapShellNextRoomText({
      text: messageBody(message),
      width: input.width,
      prefix,
    });
    if (!authoredByUser) {
      rows.push({
        key: `message:${message.messageId}:author`,
        plainText: label,
        content: styled([chunk({ text: label, fg: "#94a3b8" })]),
      });
    }
    wrapped.forEach((text, index) => {
      rows.push({
        key: `message:${message.messageId}:row-${index}`,
        plainText: text,
        content: styled([
          chunk({
            text,
            fg: authoredByUser ? "#d1d5db" : "#e5e7eb",
            bg: authoredByUser ? "#1f2937" : undefined,
          }),
        ]),
      });
    });
    rows.push({ key: `message:${message.messageId}:spacer`, plainText: "", content: "" });
  }

  if (rows.length === 0) {
    const text = "@agenter  当前 room 还没有消息。";
    return [
      {
        key: "empty",
        plainText: text,
        content: styled([chunk({ text, fg: "#94a3b8" })]),
      },
    ];
  }

  return rows;
};

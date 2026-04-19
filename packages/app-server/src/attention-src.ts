import { AttentionSourceRegistry } from "@agenter/attention-system";

export const MESSAGE_ATTENTION_NAMESPACE = "msg";
export const TERMINAL_ATTENTION_NAMESPACE = "tty";
export const TASK_ATTENTION_NAMESPACE = "task";

export interface MessageAttentionSrc {
  chatId: string;
  messageId?: number;
}

export interface TerminalAttentionSrc {
  terminalId: string;
  eventId?: number;
}

export function formatMessageAttentionSrc(input: { chatId: string }): `msg:${string}`;
export function formatMessageAttentionSrc(input: { chatId: string; messageId: number }): `msg:${string}/${number}`;
export function formatMessageAttentionSrc(input: MessageAttentionSrc): `msg:${string}` | `msg:${string}/${number}`;
export function formatMessageAttentionSrc(input: MessageAttentionSrc): `msg:${string}` | `msg:${string}/${number}` {
  return input.messageId === undefined
    ? `${MESSAGE_ATTENTION_NAMESPACE}:${input.chatId}`
    : `${MESSAGE_ATTENTION_NAMESPACE}:${input.chatId}/${input.messageId}`;
}

export const parseMessageAttentionSrc = (src: string): MessageAttentionSrc | null => {
  if (!src.startsWith(`${MESSAGE_ATTENTION_NAMESPACE}:`)) {
    return null;
  }
  const body = src.slice(`${MESSAGE_ATTENTION_NAMESPACE}:`.length);
  if (body.length === 0) {
    return null;
  }
  const separatorIndex = body.lastIndexOf("/");
  if (separatorIndex === -1) {
    return { chatId: body };
  }
  if (separatorIndex <= 0 || separatorIndex === body.length - 1) {
    return null;
  }
  const chatId = body.slice(0, separatorIndex);
  const messageId = Number(body.slice(separatorIndex + 1));
  return Number.isInteger(messageId) && messageId > 0 ? { chatId, messageId } : null;
};

const compareMessageAttentionSrc = (left: MessageAttentionSrc, right: MessageAttentionSrc): number => {
  if (left.chatId !== right.chatId) {
    return left.chatId.localeCompare(right.chatId);
  }
  if (left.messageId === undefined && right.messageId === undefined) {
    return 0;
  }
  if (left.messageId === undefined) {
    return -1;
  }
  if (right.messageId === undefined) {
    return 1;
  }
  return left.messageId - right.messageId;
};

export const formatTerminalAttentionSrc = (input: TerminalAttentionSrc): `tty:${string}` | `tty:${string}/${number}` =>
  input.eventId === undefined
    ? `${TERMINAL_ATTENTION_NAMESPACE}:${input.terminalId}`
    : `${TERMINAL_ATTENTION_NAMESPACE}:${input.terminalId}/${input.eventId}`;

export const parseTerminalAttentionSrc = (src: string): TerminalAttentionSrc | null => {
  if (!src.startsWith(`${TERMINAL_ATTENTION_NAMESPACE}:`)) {
    return null;
  }
  const body = src.slice(`${TERMINAL_ATTENTION_NAMESPACE}:`.length);
  if (body.length === 0) {
    return null;
  }
  const separatorIndex = body.lastIndexOf("/");
  if (separatorIndex <= 0 || separatorIndex === body.length - 1) {
    return { terminalId: body };
  }
  const terminalId = body.slice(0, separatorIndex);
  const eventId = Number(body.slice(separatorIndex + 1));
  return Number.isInteger(eventId) && eventId >= 0 ? { terminalId, eventId } : { terminalId: body };
};

export const formatTaskAttentionSrc = (subjectId: string): `task:${string}` => `${TASK_ATTENTION_NAMESPACE}:${subjectId}`;

export const parseTaskAttentionSrc = (src: string): string | null => {
  if (!src.startsWith(`${TASK_ATTENTION_NAMESPACE}:`)) {
    return null;
  }
  const subjectId = src.slice(`${TASK_ATTENTION_NAMESPACE}:`.length);
  return subjectId.length > 0 ? subjectId : null;
};

export const appAttentionSourceRegistry = new AttentionSourceRegistry();

appAttentionSourceRegistry.register({
  namespace: MESSAGE_ATTENTION_NAMESPACE,
  parse: parseMessageAttentionSrc,
  format: formatMessageAttentionSrc,
  key: formatMessageAttentionSrc,
  bucket: (ref) => `${MESSAGE_ATTENTION_NAMESPACE}:${ref.chatId}`,
  sourceId: (ref) => ref.chatId,
  compare: compareMessageAttentionSrc,
});

appAttentionSourceRegistry.register({
  namespace: TERMINAL_ATTENTION_NAMESPACE,
  parse: parseTerminalAttentionSrc,
  format: formatTerminalAttentionSrc,
  key: (ref) => `${TERMINAL_ATTENTION_NAMESPACE}:${ref.terminalId}`,
  bucket: (ref) => `${TERMINAL_ATTENTION_NAMESPACE}:${ref.terminalId}`,
  sourceId: (ref) => ref.terminalId,
  compare: (left, right) =>
    left.terminalId === right.terminalId
      ? (left.eventId ?? Number.MAX_SAFE_INTEGER) - (right.eventId ?? Number.MAX_SAFE_INTEGER)
      : left.terminalId.localeCompare(right.terminalId),
});

appAttentionSourceRegistry.register({
  namespace: TASK_ATTENTION_NAMESPACE,
  parse: parseTaskAttentionSrc,
  format: formatTaskAttentionSrc,
  key: formatTaskAttentionSrc,
  bucket: formatTaskAttentionSrc,
  sourceId: (ref) => ref,
});

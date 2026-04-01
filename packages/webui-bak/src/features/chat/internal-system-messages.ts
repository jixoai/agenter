import type { RuntimeChatMessage } from "@agenter/client-sdk";

const INTERNAL_FAILURE_PREFIXES = ["agenter-ai call failed:", "agenter-ai 调用失败:", "agenter-ai 调用失败："];

const stripInternalFailurePrefix = (content: string): string | null => {
  const normalized = content.trim();
  for (const prefix of INTERNAL_FAILURE_PREFIXES) {
    if (!normalized.startsWith(prefix)) {
      continue;
    }
    return normalized.slice(prefix.length).trim();
  }
  return null;
};

export const isInternalFailureMessage = (message: Pick<RuntimeChatMessage, "role" | "channel" | "content">): boolean =>
  message.role === "assistant" &&
  (message.channel === undefined || message.channel === "to_user") &&
  stripInternalFailurePrefix(message.content) !== null;

export const extractInternalFailureNotice = (
  messages: readonly Pick<RuntimeChatMessage, "role" | "channel" | "content">[],
): string | null => {
  for (const message of [...messages].reverse()) {
    if (!isInternalFailureMessage(message)) {
      continue;
    }
    return stripInternalFailurePrefix(message.content) ?? message.content.trim();
  }
  return null;
};

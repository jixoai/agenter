import type { SessionBlockRecord, SessionCollectedInput, SessionCycleRecord } from "@agenter/session-system";

export const DEFAULT_MESSAGE_CHAT_ID = "chat-main";

const readCollectedInputChatId = (input: SessionCollectedInput): string | null => {
  const chatId =
    typeof input.meta?.chatId === "string"
      ? input.meta.chatId
      : typeof input.meta?.channelId === "string"
        ? input.meta.channelId
        : null;
  if (!chatId) {
    return null;
  }
  const normalized = chatId.trim();
  return normalized.length > 0 ? normalized : null;
};

const readCollectedInputCreatedAt = (input: SessionCollectedInput): number => {
  const createdAt = input.meta?.createdAt;
  if (typeof createdAt === "number" && Number.isFinite(createdAt)) {
    return createdAt;
  }
  if (typeof createdAt === "string") {
    const parsed = Date.parse(createdAt);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return Number.NEGATIVE_INFINITY;
};

export const resolveCollectedInputsChatId = (
  inputs: SessionCollectedInput[],
  fallback = DEFAULT_MESSAGE_CHAT_ID,
): string => {
  let best: { chatId: string; createdAt: number; index: number } | null = null;
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    const chatId = readCollectedInputChatId(input);
    if (!chatId) {
      continue;
    }
    const createdAt = readCollectedInputCreatedAt(input);
    if (
      best === null ||
      createdAt > best.createdAt ||
      (createdAt === best.createdAt && index > best.index)
    ) {
      best = { chatId, createdAt, index };
    }
  }
  return best?.chatId ?? fallback;
};

export const resolveSessionBlockChatId = (input: {
  block: Pick<SessionBlockRecord, "cycleId">;
  getCycleById: (cycleId: number) => Pick<SessionCycleRecord, "collectedInputs"> | null;
  fallback?: string;
}): string => {
  if (input.block.cycleId === null) {
    return input.fallback ?? DEFAULT_MESSAGE_CHAT_ID;
  }
  return resolveCollectedInputsChatId(
    input.getCycleById(input.block.cycleId)?.collectedInputs ?? [],
    input.fallback ?? DEFAULT_MESSAGE_CHAT_ID,
  );
};

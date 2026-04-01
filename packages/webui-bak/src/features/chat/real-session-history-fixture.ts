import type { RuntimeChatMessage } from "@agenter/client-sdk";

export interface RealSessionHistoryFixture {
  messages: RuntimeChatMessage[];
  unreadMessageIds: string[];
  attachmentAssetId: string;
  attachmentName: string;
}

export const createRealSessionHistoryFixture = (input?: {
  turns?: number;
  unreadCount?: number;
}): RealSessionHistoryFixture => {
  const turns = input?.turns ?? 14;
  const unreadCount = input?.unreadCount ?? 3;
  const attachmentAssetId = "session-file-1";
  const attachmentName = "briefing.png";
  const messages: RuntimeChatMessage[] = [];

  for (let index = 0; index < turns; index += 1) {
    const cycleId = index + 1;
    const baseTimestamp = 1_710_000_000_000 + index * 120_000;
    messages.push({
      id: `user-${cycleId}`,
      role: "user",
      content: `User request ${cycleId}: inspect the current workspace turn ${cycleId}.`,
      timestamp: baseTimestamp,
      cycleId,
      attachments:
        cycleId === 4
          ? [
              {
                assetId: attachmentAssetId,
                kind: "image",
                mimeType: "image/png",
                name: attachmentName,
                sizeBytes: 4096,
                url: "https://placehold.co/480x320/png",
              },
            ]
          : undefined,
    });
    messages.push({
      id: `assistant-${cycleId}`,
      role: "assistant",
      channel: "to_user",
      content: `Assistant reply ${cycleId}: completed the visible conversation turn ${cycleId}.`,
      timestamp: baseTimestamp + 60_000,
      cycleId,
    });
  }

  const unreadMessageIds = messages
    .filter((message) => message.role === "assistant")
    .slice(-unreadCount)
    .map((message) => message.id);

  return {
    messages,
    unreadMessageIds,
    attachmentAssetId,
    attachmentName,
  };
};

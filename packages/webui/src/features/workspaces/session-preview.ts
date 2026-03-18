import type { RuntimeClientState, WorkspaceSessionEntry } from "@agenter/client-sdk";

type ChatMessage = RuntimeClientState["chatsBySession"][string][number];
type WorkspaceSessionPreview = WorkspaceSessionEntry["preview"];

export const deriveWorkspaceSessionPreview = (messages: ChatMessage[]): WorkspaceSessionPreview => {
  const firstUserMessage = messages.find((item) => item.role === "user")?.content.trim() || null;
  const latestMessages = messages
    .filter((item) => item.role === "user" || item.channel === "to_user")
    .map((item) => item.content.trim())
    .filter((item) => item.length > 0)
    .slice(-3);

  return {
    firstUserMessage,
    latestMessages,
  };
};

export const workspaceSessionPreviewEquals = (
  left: WorkspaceSessionPreview,
  right: WorkspaceSessionPreview,
): boolean => {
  if (left.firstUserMessage !== right.firstUserMessage) {
    return false;
  }
  if (left.latestMessages.length !== right.latestMessages.length) {
    return false;
  }
  return left.latestMessages.every((item, index) => item === right.latestMessages[index]);
};

export const workspaceSessionPreviewText = (preview: WorkspaceSessionPreview): string => {
  if (preview.latestMessages.length > 0) {
    return preview.latestMessages.join(" | ");
  }
  return preview.firstUserMessage ?? "No chat yet.";
};

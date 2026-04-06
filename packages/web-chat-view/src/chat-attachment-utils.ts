import type { MessageAttachmentKind } from "@agenter/message-system/types";

export const resolveAttachmentKind = (fileLike: { type: string }): MessageAttachmentKind => {
  const mimeType = fileLike.type.toLowerCase();
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

export const formatAttachmentSize = (sizeBytes: number): string => {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KB", "MB", "GB"] as const;
  let value = sizeBytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

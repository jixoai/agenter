import type { MessageAttachmentKind } from "@agenter/message-system/types";

import { resolveAttachmentKind } from "../chat-attachment-utils";

export interface PendingAsset {
  id: string;
  kind: MessageAttachmentKind;
  file: File;
  previewUrl: string;
}

const createPendingAssetId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const normalizeAttachableFiles = (
  files: Iterable<File> | ArrayLike<File>,
  imageEnabled: boolean,
): File[] => {
  const accepted: File[] = [];
  for (const file of Array.from(files)) {
    const kind = resolveAttachmentKind(file);
    if (kind === "image" && !imageEnabled) {
      continue;
    }
    accepted.push(file);
  }
  return accepted;
};

const dedupeFiles = (files: File[]): File[] => {
  const seen = new Set<string>();
  const deduped: File[] = [];
  for (const file of files) {
    const signature = [file.name, file.type, file.size, file.lastModified].join(":");
    if (seen.has(signature)) {
      continue;
    }
    seen.add(signature);
    deduped.push(file);
  }
  return deduped;
};

export const extractFilesFromTransfer = (
  dataTransfer: DataTransfer | null | undefined,
  input: { imageEnabled: boolean; imageOnly?: boolean },
): File[] => {
  if (!dataTransfer) {
    return [];
  }
  const fromFiles = normalizeAttachableFiles(dataTransfer.files, input.imageEnabled);
  const fromItems = Array.from(dataTransfer.items ?? [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file instanceof File)
    .filter((file) => {
      const kind = resolveAttachmentKind(file);
      if (input.imageOnly) {
        return kind === "image" && input.imageEnabled;
      }
      return kind !== "image" || input.imageEnabled;
    });
  return dedupeFiles([...fromFiles, ...fromItems]).filter((file) => {
    const kind = resolveAttachmentKind(file);
    return input.imageOnly ? kind === "image" : kind !== "image" || input.imageEnabled;
  });
};

export const hasFileTransfer = (dataTransfer: DataTransfer | null | undefined): boolean => {
  if (!dataTransfer) {
    return false;
  }
  if (dataTransfer.files.length > 0 || Array.from(dataTransfer.items ?? []).some((item) => item.kind === "file")) {
    return true;
  }
  return Array.from(dataTransfer.types).some((type) => type === "Files");
};

export const createPendingAsset = (file: File): PendingAsset => ({
  id: createPendingAssetId(),
  kind: resolveAttachmentKind(file),
  file,
  previewUrl: URL.createObjectURL(file),
});

export const revokePendingAssetPreview = (asset: PendingAsset): void => {
  URL.revokeObjectURL(asset.previewUrl);
};

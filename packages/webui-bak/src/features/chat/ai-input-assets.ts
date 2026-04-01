import type { ChatPreviewAsset } from "./ChatAssetPreviewDialog";
import type { PendingAsset, PendingAssetKind } from "./ai-input-types";

const createPendingAssetId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export const resolvePendingAssetKind = (file: File): PendingAssetKind => {
  const mimeType = file.type.toLowerCase();
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  return "file";
};

export const normalizeAttachableFiles = (files: Iterable<File> | ArrayLike<File>, imageEnabled: boolean): File[] => {
  const accepted: File[] = [];
  for (const file of Array.from(files)) {
    const kind = resolvePendingAssetKind(file);
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
      const kind = resolvePendingAssetKind(file);
      if (input.imageOnly) {
        return kind === "image" && input.imageEnabled;
      }
      return kind !== "image" || input.imageEnabled;
    });

  return dedupeFiles([...fromFiles, ...fromItems]).filter((file) => {
    const kind = resolvePendingAssetKind(file);
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
  kind: resolvePendingAssetKind(file),
  file,
  previewUrl: URL.createObjectURL(file),
});

export const revokePendingAssetPreview = (asset: PendingAsset): void => {
  URL.revokeObjectURL(asset.previewUrl);
};

export const toPendingAssetPreview = (asset: PendingAsset): ChatPreviewAsset => ({
  kind: asset.kind,
  name: asset.file.name,
  url: asset.previewUrl,
  mimeType: asset.file.type || "application/octet-stream",
  sizeBytes: asset.file.size,
  actionLabel: "Download",
  downloadName: asset.file.name,
  openInNewTab: false,
});

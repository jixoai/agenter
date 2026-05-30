import type { PasteEvent } from "@opentui/core";
import { decodePasteBytes } from "@opentui/core";

export type OpenComposePasteMediaKind = "image" | "video" | "file";

export interface OpenComposePasteMediaItem {
  kind: OpenComposePasteMediaKind;
  mimeType: string;
  name?: string;
  bytes?: Uint8Array;
}

export type OpenComposePastePayload =
  | { kind: "text"; text: string }
  | { kind: "media"; items: readonly OpenComposePasteMediaItem[] }
  | { kind: "unsupported" };

const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  heic: "image/heic",
  heif: "image/heif",
};

const imageMimeTypes = new Set(Object.values(MIME_BY_EXTENSION));

const readRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;

export const resolveOpenComposePasteMediaKind = (mimeType: string): OpenComposePasteMediaKind | null => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) {
    return "image";
  }
  if (normalized.startsWith("video/")) {
    return "video";
  }
  if (normalized.length > 0) {
    return "file";
  }
  return null;
};

export const readOpenComposePasteMimeTypes = (value: unknown): string[] => {
  const record = readRecord(value);
  if (!record) {
    return [];
  }
  const metadata = readRecord(record.metadata);
  const candidates = [record.mimeTypes, record.types, metadata?.mimeTypes, metadata?.types, metadata?.mimeType];
  return candidates
    .flatMap((candidate) => (Array.isArray(candidate) ? candidate : [candidate]))
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
};

export const inferOpenComposePasteMediaFromText = (text: string): readonly OpenComposePasteMediaItem[] => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("file://")) {
    return [];
  }
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(trimmed).pathname);
  } catch {
    return [];
  }
  const extension = pathname.split(".").pop()?.toLowerCase() ?? "";
  const mimeType = MIME_BY_EXTENSION[extension];
  if (!mimeType) {
    return [];
  }
  return [{ kind: "image", mimeType, name: pathname.split("/").pop() ?? undefined }];
};

export const readOpenComposePastePayload = (value: unknown): OpenComposePastePayload => {
  const mimeTypes = readOpenComposePasteMimeTypes(value);
  const mediaItems = mimeTypes.flatMap((mimeType): OpenComposePasteMediaItem[] => {
    const kind = resolveOpenComposePasteMediaKind(mimeType);
    return kind ? [{ kind, mimeType }] : [];
  });
  if (mediaItems.length > 0) {
    return { kind: "media", items: mediaItems };
  }

  const text = readOpenComposePasteText(value);
  if (text !== null) {
    const inferredMedia = inferOpenComposePasteMediaFromText(text);
    return inferredMedia.length > 0 ? { kind: "media", items: inferredMedia } : { kind: "text", text };
  }

  return { kind: "unsupported" };
};

export const isOpenComposeImagePastePayload = (payload: OpenComposePastePayload): boolean =>
  payload.kind === "media" && payload.items.some((item) => item.kind === "image" || imageMimeTypes.has(item.mimeType));

export const readOpenComposePasteText = (value: unknown): string | null => {
  const record = readRecord(value);
  if (!record) {
    return null;
  }
  const bytes = (record as Partial<PasteEvent>).bytes;
  return bytes instanceof Uint8Array ? decodePasteBytes(bytes) : null;
};

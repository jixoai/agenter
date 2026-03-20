import type { SessionAssetKind, SessionAssetRecord } from "@agenter/session-system";
import { extname, posix as posixPath } from "node:path";

import type { ChatSessionAsset } from "./types";

const ASSET_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
  "image/bmp": ".bmp",
  "image/x-icon": ".ico",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
  "video/x-matroska": ".mkv",
  "video/ogg": ".ogv",
};

const ASSET_FOLDER_BY_KIND: Record<SessionAssetKind, string> = {
  image: "images",
  video: "videos",
  file: "files",
};

export const resolveSessionAssetKind = (mimeType: string): SessionAssetKind => {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized.startsWith("image/")) {
    return "image";
  }
  if (normalized.startsWith("video/")) {
    return "video";
  }
  return "file";
};

export const resolveSessionAssetExtension = (name: string, mimeType: string): string => {
  const byMime = ASSET_EXTENSION_BY_MIME[mimeType.trim().toLowerCase()];
  if (byMime) {
    return byMime;
  }
  const byName = extname(name).trim().toLowerCase();
  return byName.length > 0 ? byName : ".bin";
};

export const buildSessionAssetRelativePath = (
  assetId: string,
  name: string,
  mimeType: string,
  kind = resolveSessionAssetKind(mimeType),
): string => {
  const folder = ASSET_FOLDER_BY_KIND[kind];
  return posixPath.join("assets", folder, `${assetId}${resolveSessionAssetExtension(name, mimeType)}`);
};

export const buildSessionAssetUrl = (sessionId: string, assetId: string): string =>
  `/media/sessions/${encodeURIComponent(sessionId)}/assets/${encodeURIComponent(assetId)}`;

export const toChatSessionAsset = (sessionId: string, asset: SessionAssetRecord): ChatSessionAsset => ({
  assetId: asset.id,
  kind: asset.kind,
  name: asset.name,
  mimeType: asset.mimeType,
  sizeBytes: asset.sizeBytes,
  url: buildSessionAssetUrl(sessionId, asset.id),
});

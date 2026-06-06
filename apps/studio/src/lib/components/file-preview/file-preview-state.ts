export type FilePreviewKind = "directory" | "text" | "image" | "audio" | "video" | "pdf" | "binary" | "unsupported";

export interface FilePreviewHttpSource {
  protocol: "http";
  url: string;
  auth?: "browser";
}

export interface FilePreviewPayload {
  path: string;
  name: string;
  kind: "directory" | "file";
  sizeBytes: number;
  modifiedAtMs: number;
  previewKind: FilePreviewKind;
  mimeType: string | null;
  textContent: string | null;
  mediaDataUrl: string | null;
  truncated: boolean;
  note: string | null;
  source?: FilePreviewHttpSource | null;
}

const TEXT_MIME_TYPES = new Set(["application/json", "application/yaml", "application/xml"]);

export const normalizePreviewMimeType = (value: string | null | undefined): string | null => {
  const normalized = value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return normalized.length > 0 ? normalized : null;
};

export const resolveFilePreviewKindFromMime = (value: string | null | undefined): FilePreviewKind => {
  const mimeType = normalizePreviewMimeType(value);
  if (!mimeType) {
    return "unsupported";
  }
  if (mimeType === "application/pdf") {
    return "pdf";
  }
  if (mimeType.startsWith("image/")) {
    return "image";
  }
  if (mimeType.startsWith("audio/")) {
    return "audio";
  }
  if (mimeType.startsWith("video/")) {
    return "video";
  }
  if (
    mimeType.startsWith("text/") ||
    TEXT_MIME_TYPES.has(mimeType) ||
    mimeType.endsWith("+json") ||
    mimeType.endsWith("+xml")
  ) {
    return "text";
  }
  return "binary";
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const isFilePreviewKind = (value: unknown): value is FilePreviewKind =>
  value === "directory" ||
  value === "text" ||
  value === "image" ||
  value === "audio" ||
  value === "video" ||
  value === "pdf" ||
  value === "binary" ||
  value === "unsupported";

const isHttpSource = (value: unknown): value is FilePreviewHttpSource => {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    value.protocol === "http" && typeof value.url === "string" && (value.auth === undefined || value.auth === "browser")
  );
};

export const isFilePreviewPayload = (value: unknown): value is FilePreviewPayload => {
  if (!isObjectRecord(value)) {
    return false;
  }
  return (
    typeof value.path === "string" &&
    typeof value.name === "string" &&
    (value.kind === "directory" || value.kind === "file") &&
    typeof value.sizeBytes === "number" &&
    typeof value.modifiedAtMs === "number" &&
    isFilePreviewKind(value.previewKind) &&
    (value.mimeType === null || typeof value.mimeType === "string") &&
    (value.textContent === null || typeof value.textContent === "string") &&
    (value.mediaDataUrl === null || typeof value.mediaDataUrl === "string") &&
    typeof value.truncated === "boolean" &&
    (value.note === null || typeof value.note === "string") &&
    (value.source === undefined || value.source === null || isHttpSource(value.source))
  );
};

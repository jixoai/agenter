import { readStoredAuthToken } from "$lib/app/auth-session-storage";
import {
  normalizePreviewMimeType,
  resolveFilePreviewKindFromMime,
  type FilePreviewPayload,
} from "./file-preview-state";

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Failed to read fetched preview."));
    });
    reader.readAsDataURL(blob);
  });

const resolveHttpPreviewUrl = (value: string): string => {
  const url = new URL(value, window.location.href);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported preview source protocol: ${url.protocol}`);
  }
  return url.toString();
};

const readContentLength = (response: Response): number | null => {
  const rawLength = response.headers.get("content-length");
  if (!rawLength) {
    return null;
  }
  const parsedLength = Number.parseInt(rawLength, 10);
  return Number.isFinite(parsedLength) && parsedLength >= 0 ? parsedLength : null;
};

export const loadHttpFilePreviewPayload = async (preview: FilePreviewPayload): Promise<FilePreviewPayload> => {
  const source = preview.source;
  if (!source || source.protocol !== "http") {
    return preview;
  }
  const headers = new Headers();
  if (source.auth === "browser") {
    const token = readStoredAuthToken();
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }
  const response = await fetch(resolveHttpPreviewUrl(source.url), {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Preview source request failed (${response.status}).`);
  }
  const mimeType = normalizePreviewMimeType(response.headers.get("content-type")) ?? preview.mimeType;
  const previewKind = resolveFilePreviewKindFromMime(mimeType);
  if (previewKind === "text") {
    const textContent = await response.text();
    return {
      ...preview,
      sizeBytes: readContentLength(response) ?? new TextEncoder().encode(textContent).byteLength,
      previewKind,
      mimeType,
      textContent,
      mediaDataUrl: null,
      note: null,
    };
  }
  const blob = await response.blob();
  const mediaDataUrl = previewKind === "binary" || previewKind === "unsupported" ? null : await blobToDataUrl(blob);
  return {
    ...preview,
    sizeBytes: readContentLength(response) ?? blob.size,
    previewKind,
    mimeType: mimeType ?? normalizePreviewMimeType(blob.type),
    textContent: null,
    mediaDataUrl,
    note: mediaDataUrl ? null : "This MIME type is not supported by the workbench previewer.",
  };
};

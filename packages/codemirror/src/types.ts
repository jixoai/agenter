export type MarkdownPreviewTone = "assistant" | "participant" | "viewer";

export interface MarkdownResourceReference {
  id: string;
  label: string;
  tokenText: string;
  kind: string;
  detailText?: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  url?: string;
  previewUrl?: string;
  extension?: string;
  assetId?: string;
  aliases?: readonly string[];
  iconUrl?: string | null;
  commentText?: string;
}

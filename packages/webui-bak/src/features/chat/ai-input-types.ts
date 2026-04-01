export type PendingAssetKind = "image" | "video" | "file";

export interface PendingAsset {
  id: string;
  kind: PendingAssetKind;
  file: File;
  previewUrl: string;
}

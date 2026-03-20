import { FileImage, FileText, Video, X } from "lucide-react";
import type { ReactElement } from "react";

import { ClipSurface } from "../../components/ui/overflow-surface";
import type { PendingAsset } from "./ai-input-types";

interface AIInputPendingAssetsProps {
  pendingAssets: PendingAsset[];
  onPreviewAsset: (assetId: string) => void;
  onRemoveAsset: (assetId: string) => void;
}

const renderPendingAssetPreview = (asset: PendingAsset) => {
  if (asset.kind === "image") {
    return <img src={asset.previewUrl} alt={asset.file.name} className="h-16 w-16 object-cover" />;
  }
  if (asset.kind === "video") {
    return (
      <div className="relative">
        <video src={asset.previewUrl} className="h-16 w-16 object-cover" muted playsInline preload="metadata" />
        <span className="absolute right-1 bottom-1 rounded-full bg-black/70 p-1 text-white">
          <Video className="h-3 w-3" />
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center bg-slate-100 text-slate-500">
      <FileText className="h-5 w-5" />
    </div>
  );
};

const formatBytes = (value: number): string => {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${value} B`;
};

const assetKindMeta = (asset: PendingAsset): { icon: ReactElement; label: string } => {
  switch (asset.kind) {
    case "image":
      return {
        icon: <FileImage className="h-3.5 w-3.5" />,
        label: "image",
      };
    case "video":
      return {
        icon: <Video className="h-3.5 w-3.5" />,
        label: "video",
      };
    default:
      return {
        icon: <FileText className="h-3.5 w-3.5" />,
        label: "file",
      };
  }
};

export const AIInputPendingAssets = ({
  pendingAssets,
  onPreviewAsset,
  onRemoveAsset,
}: AIInputPendingAssetsProps) => {
  if (pendingAssets.length === 0) {
    return null;
  }

  return (
    <div className="border-b border-slate-200 px-3 py-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Pending attachments</p>
          <p className="text-xs text-slate-500">These files stay local until you send this message.</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
          {pendingAssets.length} queued
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-[color-mix(in_srgb,currentColor,transparent)]">
        {pendingAssets.map((asset) => {
          const meta = assetKindMeta(asset);
          return (
            <div key={asset.id} className="shrink-0">
              <ClipSurface className="rounded-2xl border border-slate-200 bg-slate-50">
                <div className="flex items-stretch">
                  <button
                    type="button"
                    onClick={() => onPreviewAsset(asset.id)}
                    title={asset.file.name}
                    className="shrink-0"
                  >
                    {renderPendingAssetPreview(asset)}
                  </button>
                  <div className="flex min-w-[12rem] flex-1 items-start justify-between gap-3 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onPreviewAsset(asset.id)}
                      title={asset.file.name}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-slate-900">{asset.file.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          {meta.icon}
                          <span>{meta.label}</span>
                        </span>
                        <span>{formatBytes(asset.file.size)}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveAsset(asset.id)}
                      aria-label={`Remove ${asset.file.name}`}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </ClipSurface>
            </div>
          );
        })}
      </div>
    </div>
  );
};

import { FileText } from "lucide-react";

import { Dialog } from "../../components/ui/dialog";

export interface ChatPreviewAsset {
  kind: "image" | "video" | "file";
  name: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  actionLabel?: string;
  downloadName?: string;
  openInNewTab?: boolean;
}

interface ChatAssetPreviewDialogProps {
  asset: ChatPreviewAsset | null;
  onClose: () => void;
}

export const ChatAssetPreviewDialog = ({ asset, onClose }: ChatAssetPreviewDialogProps) => (
  <Dialog
    open={asset !== null}
    title={asset?.name ?? "Attachment preview"}
    description={asset ? `${asset.mimeType} · ${asset.sizeBytes} bytes` : undefined}
    onClose={onClose}
  >
    {asset ? (
      asset.kind === "image" ? (
        <img src={asset.url} alt={asset.name} className="max-h-[72vh] w-auto rounded-xl" />
      ) : asset.kind === "video" ? (
        <video src={asset.url} controls className="max-h-[72vh] w-full rounded-xl bg-black" />
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="font-medium">{asset.name}</span>
          </div>
          <a
            href={asset.url}
            download={asset.downloadName}
            target={asset.openInNewTab === false ? undefined : "_blank"}
            rel={asset.openInNewTab === false ? undefined : "noreferrer"}
            className="inline-flex rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
          >
            {asset.actionLabel ?? "Open attachment"}
          </a>
        </div>
      )
    ) : null}
  </Dialog>
);

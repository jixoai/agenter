import { FileImage, FileText, Video } from "lucide-react";
import type { ReactElement } from "react";

import { ClipSurface } from "../../components/ui/overflow-surface";
import type { MessageAttachment } from "./chat-projection";

const renderAttachmentTile = (attachment: MessageAttachment) => {
  if (attachment.kind === "image") {
    return <img src={attachment.url} alt={attachment.name} className="h-20 w-20 object-cover" loading="lazy" />;
  }
  if (attachment.kind === "video") {
    return (
      <div className="relative flex h-20 w-20 items-center justify-center bg-slate-900 text-white">
        <Video className="h-5 w-5" />
        <span className="absolute right-1 bottom-1 rounded-full bg-white/18 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]">
          video
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-20 w-20 items-center justify-center bg-slate-100 text-slate-500">
      <FileText className="h-5 w-5" />
    </div>
  );
};

const formatAttachmentMeta = (attachment: MessageAttachment): { icon: ReactElement; label: string } => {
  switch (attachment.kind) {
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

interface ChatAttachmentStripProps {
  attachments: MessageAttachment[];
  onPreview: (assetId: string) => void;
}

export const ChatAttachmentStrip = ({ attachments, onPreview }: ChatAttachmentStripProps) => (
  <div className="flex flex-wrap gap-2">
    {attachments.map((attachment) => {
      const meta = formatAttachmentMeta(attachment);
      return (
        <ClipSurface key={attachment.assetId} className="rounded-2xl border border-slate-200 bg-slate-100">
          <button
            type="button"
            onClick={() => onPreview(attachment.assetId)}
            title={attachment.name}
            className="flex items-stretch text-left"
          >
            {renderAttachmentTile(attachment)}
            <span className="flex min-w-0 max-w-48 flex-col justify-center gap-1 px-3 py-2">
              <span className="truncate text-xs font-medium text-slate-800">{attachment.name}</span>
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                {meta.icon}
                <span>{meta.label}</span>
              </span>
            </span>
          </button>
        </ClipSurface>
      );
    })}
  </div>
);

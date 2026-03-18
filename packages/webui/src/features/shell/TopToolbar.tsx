import { Activity, FolderOpen, PanelLeftOpen, Play, Plus, Square, Trash2 } from "lucide-react";

import { IconAction } from "./IconAction";

interface TopToolbarProps {
  showMobileDevtools: boolean;
  activeSessionId: string | null;
  onOpenNavigation: () => void;
  onOpenDevtools: () => void;
  onOpenCreate: () => void;
  onOpenWorkspace: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
}

export const TopToolbar = ({
  showMobileDevtools,
  activeSessionId,
  onOpenNavigation,
  onOpenDevtools,
  onOpenCreate,
  onOpenWorkspace,
  onStart,
  onStop,
  onDelete,
}: TopToolbarProps) => (
  <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur">
    <div className="mx-auto flex items-center gap-2">
      <IconAction
        label="Open navigation"
        icon={PanelLeftOpen}
        variant="ghost"
        className="md:hidden"
        onClick={onOpenNavigation}
      />
      <h1 className="font-nav text-sm font-semibold tracking-tight">Agenter</h1>
      <div className="ml-auto flex items-center gap-1">
        {showMobileDevtools ? <IconAction label="Open Devtools" icon={Activity} onClick={onOpenDevtools} /> : null}
        <IconAction label="New session" icon={Plus} onClick={onOpenCreate} />
        <IconAction label="Select workspace" icon={FolderOpen} onClick={onOpenWorkspace} />
        <IconAction label="Start session" icon={Play} disabled={!activeSessionId} onClick={onStart} />
        <IconAction label="Stop session" icon={Square} disabled={!activeSessionId} onClick={onStop} />
        <IconAction
          label="Delete session"
          icon={Trash2}
          variant="destructive"
          disabled={!activeSessionId}
          onClick={onDelete}
        />
      </div>
    </div>
  </header>
);

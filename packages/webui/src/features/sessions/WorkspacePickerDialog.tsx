import { ChevronRight, Folder, FolderOpen, RotateCcw, StepBack } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import {
  InlineAffordanceLabel,
  InlineAffordanceLeadingVisual,
  InlineAffordanceTrailingVisual,
  inlineAffordanceClassName,
} from "../../components/ui/inline-affordance";

interface DirectoryEntry {
  name: string;
  path: string;
}

interface WorkspacePickerDialogProps {
  open: boolean;
  initialPath: string;
  recentWorkspaces: string[];
  onClose: () => void;
  onPick: (path: string) => void;
  listDirectories: (input: { path?: string; includeHidden?: boolean }) => Promise<DirectoryEntry[]>;
  validateDirectory: (path: string) => Promise<{ ok: boolean; path: string }>;
}

export const WorkspacePickerDialog = ({
  open,
  initialPath,
  recentWorkspaces,
  onClose,
  onPick,
  listDirectories,
  validateDirectory,
}: WorkspacePickerDialogProps) => {
  const [pathInput, setPathInput] = useState(initialPath);
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState(initialPath);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("ready");

  useEffect(() => {
    if (!open) {
      return;
    }
    setPathInput(initialPath);
    setCurrentPath(initialPath);
    setSelectedPath(initialPath);
    setStatus("ready");
  }, [initialPath, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    setLoading(true);
    void listDirectories({ path: currentPath, includeHidden: false })
      .then((next) => {
        if (!active) {
          return;
        }
        setEntries(next);
        setStatus(next.length === 0 ? "no sub-directories" : "ready");
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        setEntries([]);
        setStatus(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [currentPath, listDirectories, open]);

  const parentPath = useMemo(() => {
    if (currentPath === "/") {
      return "/";
    }
    const parts = currentPath.split("/").filter((token) => token.length > 0);
    if (parts.length <= 1) {
      return "/";
    }
    return `/${parts.slice(0, -1).join("/")}`;
  }, [currentPath]);

  const handleOpenPath = () => {
    if (pathInput.trim().length === 0) {
      return;
    }
    setCurrentPath(pathInput.trim());
  };

  const handleConfirm = async () => {
    const resolved = await validateDirectory(selectedPath);
    if (!resolved.ok) {
      setStatus(`invalid directory: ${resolved.path}`);
      return;
    }
    onPick(resolved.path);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Select workspace"
      description="Directory-only tree with lazy loading."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()}>Use this folder</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={pathInput}
            onChange={(event) => setPathInput(event.target.value)}
            placeholder="/path/to/workspace"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                handleOpenPath();
              }
            }}
          />
          <Button type="button" variant="secondary" onClick={handleOpenPath}>
            Open
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <Button type="button" size="sm" variant="ghost" onClick={() => setCurrentPath(parentPath)}>
            <ButtonLeadingVisual>
              <StepBack className="h-3.5 w-3.5" />
            </ButtonLeadingVisual>
            <ButtonLabel>Up</ButtonLabel>
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCurrentPath(currentPath)}>
            <ButtonLeadingVisual>
              <RotateCcw className="h-3.5 w-3.5" />
            </ButtonLeadingVisual>
            <ButtonLabel>Refresh</ButtonLabel>
          </Button>
          <span className="rounded-md bg-slate-100 px-2 py-1 font-mono">{currentPath}</span>
          <span className="rounded-md bg-teal-50 px-2 py-1 font-mono text-teal-700">selected: {selectedPath}</span>
        </div>

        {recentWorkspaces.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-medium text-slate-700">Recent</p>
            <div className="flex flex-wrap gap-2">
              {recentWorkspaces.map((workspace) => (
                <button
                  key={workspace}
                  type="button"
                  onClick={() => {
                    setSelectedPath(workspace);
                    setPathInput(workspace);
                    setCurrentPath(workspace);
                  }}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100"
                >
                  {workspace}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="max-h-[42dvh] overflow-auto rounded-md border border-slate-200">
          {loading ? <p className="p-3 text-xs text-slate-500">Loading...</p> : null}
          {!loading && entries.length === 0 ? <p className="p-3 text-xs text-slate-500">{status}</p> : null}
          {!loading && entries.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {entries.map((entry) => {
                const active = selectedPath === entry.path;
                return (
                  <li key={entry.path}>
                    <button
                      type="button"
                      onClick={() => setSelectedPath(entry.path)}
                      onDoubleClick={() => {
                        setCurrentPath(entry.path);
                        setPathInput(entry.path);
                        setSelectedPath(entry.path);
                      }}
                      className={inlineAffordanceClassName({
                        size: "control",
                        layout: "both",
                        fill: true,
                        className: active
                          ? "text-left text-teal-900 bg-teal-50"
                          : "text-left hover:bg-slate-50",
                      })}
                    >
                      <InlineAffordanceLeadingVisual>
                        {active ? <FolderOpen className="h-4 w-4" /> : <Folder className="h-4 w-4 text-slate-500" />}
                      </InlineAffordanceLeadingVisual>
                      <InlineAffordanceLabel className="truncate">{entry.name}</InlineAffordanceLabel>
                      <InlineAffordanceTrailingVisual className="ml-auto">
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      </InlineAffordanceTrailingVisual>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
};

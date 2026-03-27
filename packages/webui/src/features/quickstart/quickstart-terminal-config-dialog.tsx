import { useEffect, useState } from "react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import type { QuickstartTerminalConfig } from "./quickstart-bootstrap-types";

interface QuickstartTerminalConfigDialogProps {
  open: boolean;
  workspacePath: string;
  value: QuickstartTerminalConfig | null;
  onClose: () => void;
  onSave: (value: QuickstartTerminalConfig) => Promise<void> | void;
}

const parseCommandDraft = (value: string): string[] => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return [];
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error("Command must be a JSON string array.");
  }
  return parsed.map((item) => item.trim());
};

const defaultTerminalId = (): string => `terminal-${Math.random().toString(36).slice(2, 8)}`;

export const QuickstartTerminalConfigDialog = ({
  open,
  workspacePath,
  value,
  onClose,
  onSave,
}: QuickstartTerminalConfigDialogProps) => {
  const [terminalId, setTerminalId] = useState(value?.terminalId ?? defaultTerminalId());
  const [commandDraft, setCommandDraft] = useState(
    JSON.stringify(value?.command.length ? value.command : ["bash", "-i"], null, 2),
  );
  const [cwd, setCwd] = useState(value?.cwd ?? workspacePath);
  const [focus, setFocus] = useState(value?.focus ?? true);
  const [autoRun, setAutoRun] = useState(value?.autoRun ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTerminalId(value?.terminalId ?? defaultTerminalId());
    setCommandDraft(JSON.stringify(value?.command.length ? value.command : ["bash", "-i"], null, 2));
    setCwd(value?.cwd ?? workspacePath);
    setFocus(value?.focus ?? true);
    setAutoRun(value?.autoRun ?? true);
    setError(null);
  }, [open, value, workspacePath]);

  const handleSave = async () => {
    const normalizedTerminalId = terminalId.trim();
    if (normalizedTerminalId.length === 0) {
      setError("Terminal ID is required.");
      return;
    }
    let command: string[];
    try {
      command = parseCommandDraft(commandDraft);
    } catch (commandError) {
      setError(commandError instanceof Error ? commandError.message : String(commandError));
      return;
    }
    if (command.length === 0) {
      setError("Command array cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        terminalId: normalizedTerminalId,
        command,
        cwd: cwd.trim() || undefined,
        focus,
        autoRun,
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : String(saveError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={value ? "Edit terminal chip" : "Add terminal chip"}
      description="Configure boot terminal descriptor persisted in workspace-local settings."
      onClose={() => {
        if (saving) {
          return;
        }
        onClose();
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? "Saving..." : value ? "Save terminal" : "Add terminal"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700" htmlFor="quickstart-terminal-id">
            Terminal ID
          </label>
          <Input id="quickstart-terminal-id" value={terminalId} onChange={(event) => setTerminalId(event.currentTarget.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700" htmlFor="quickstart-terminal-command">
            Command JSON array
          </label>
          <Textarea
            id="quickstart-terminal-command"
            className="h-24 font-mono text-xs"
            value={commandDraft}
            onChange={(event) => setCommandDraft(event.currentTarget.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700" htmlFor="quickstart-terminal-cwd">
            Working directory
          </label>
          <Input id="quickstart-terminal-cwd" value={cwd} onChange={(event) => setCwd(event.currentTarget.value)} />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={focus}
              onChange={(event) => setFocus(event.currentTarget.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Focus after boot
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(event) => setAutoRun(event.currentTarget.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Auto run on startup
          </label>
        </div>
        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      </div>
    </Dialog>
  );
};

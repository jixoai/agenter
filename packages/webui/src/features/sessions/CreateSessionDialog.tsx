import { useState } from "react";
import { FolderTree } from "lucide-react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";

interface CreateSessionDialogProps {
  open: boolean;
  cwd: string;
  onClose: () => void;
  onOpenWorkspacePicker: () => void;
  onCreate: (input: { cwd: string; name?: string }) => Promise<void>;
}

export const CreateSessionDialog = ({
  open,
  cwd,
  onClose,
  onOpenWorkspacePicker,
  onCreate,
}: CreateSessionDialogProps) => {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("ready");

  const handleSubmit = async () => {
    if (cwd.trim().length === 0) {
      setStatus("workspace path is required");
      return;
    }
    setSubmitting(true);
    setStatus("creating...");
    try {
      await onCreate({
        cwd,
        name: name.trim().length > 0 ? name.trim() : undefined,
      });
      setStatus("created");
      onClose();
      setName("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Create session"
      description="Create and start a session from a selected workspace."
      footer={
        <>
          <span className="mr-auto text-xs text-slate-500">{status}</span>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="space-y-1 text-sm text-slate-700">
          <span>Session name</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="workspace" />
        </label>
        <label className="space-y-1 text-sm text-slate-700">
          <span>Workspace path</span>
          <div className="flex gap-2">
            <Input value={cwd} readOnly />
            <Button type="button" variant="secondary" onClick={onOpenWorkspacePicker} title="Select workspace folder">
              <FolderTree className="h-4 w-4" />
              Browse
            </Button>
          </div>
        </label>
      </div>
    </Dialog>
  );
};

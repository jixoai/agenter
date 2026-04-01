import { useEffect, useState } from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../../components/ui/accordion";
import { Button } from "../../components/ui/button";
import { Checkbox } from "../../components/ui/checkbox";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

interface TerminalCreateDialogInput {
  terminalId?: string;
  processKind?: string;
  command?: string[];
  cwd?: string;
  profile?: {
    command?: string[];
    cwd?: string;
    cols?: number;
    rows?: number;
    gitLog?: false | "none" | "normal" | "verbose";
    logStyle?: "plain" | "rich";
    icon?: string;
    title?: string;
    shortcuts?: Record<string, string>;
  };
  focus?: boolean;
}

interface TerminalCreateDialogProps {
  open: boolean;
  defaultCwd?: string;
  onClose: () => void;
  onCreate: (input: TerminalCreateDialogInput) => Promise<void> | void;
}

const parseStringArrayJson = (value: string, label: string): string[] | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === "string" && item.trim().length > 0)) {
    throw new Error(`${label} must be a JSON string array.`);
  }
  return parsed.map((item) => item.trim());
};

const parseRecordJson = (value: string, label: string): Record<string, string> | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object.`);
  }
  const entries = Object.entries(parsed);
  if (entries.some((entry) => typeof entry[1] !== "string" || entry[1].trim().length === 0)) {
    throw new Error(`${label} values must be non-empty strings.`);
  }
  return Object.fromEntries(entries.map(([key, item]) => [key, (item as string).trim()]));
};

const parsePositiveInt = (value: string, label: string): number | undefined => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
};

export const TerminalCreateDialog = ({ open, defaultCwd, onClose, onCreate }: TerminalCreateDialogProps) => {
  const [terminalId, setTerminalId] = useState("");
  const [processKind, setProcessKind] = useState("shell");
  const [commandDraft, setCommandDraft] = useState("");
  const [cwd, setCwd] = useState(defaultCwd ?? "");
  const [focus, setFocus] = useState(false);
  const [profileCommandDraft, setProfileCommandDraft] = useState("");
  const [profileCwd, setProfileCwd] = useState("");
  const [profileCols, setProfileCols] = useState("");
  const [profileRows, setProfileRows] = useState("");
  const [profileGitLog, setProfileGitLog] = useState("");
  const [profileLogStyle, setProfileLogStyle] = useState("");
  const [profileIcon, setProfileIcon] = useState("");
  const [profileTitle, setProfileTitle] = useState("");
  const [profileShortcutsDraft, setProfileShortcutsDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTerminalId("");
    setProcessKind("shell");
    setCommandDraft("");
    setCwd(defaultCwd ?? "");
    setFocus(false);
    setProfileCommandDraft("");
    setProfileCwd("");
    setProfileCols("");
    setProfileRows("");
    setProfileGitLog("");
    setProfileLogStyle("");
    setProfileIcon("");
    setProfileTitle("");
    setProfileShortcutsDraft("");
    setError(null);
  }, [defaultCwd, open]);

  const handleCreate = async () => {
    let command: string[] | undefined;
    let profileCommand: string[] | undefined;
    let profileShortcuts: Record<string, string> | undefined;
    let cols: number | undefined;
    let rows: number | undefined;
    try {
      command = parseStringArrayJson(commandDraft, "Command");
      profileCommand = parseStringArrayJson(profileCommandDraft, "Profile command");
      profileShortcuts = parseRecordJson(profileShortcutsDraft, "Profile shortcuts");
      cols = parsePositiveInt(profileCols, "Profile cols");
      rows = parsePositiveInt(profileRows, "Profile rows");
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
      return;
    }

    const normalizedTerminalId = terminalId.trim();
    const normalizedProcessKind = processKind.trim();
    const normalizedCwd = cwd.trim();
    const normalizedProfileCwd = profileCwd.trim();
    const normalizedProfileIcon = profileIcon.trim();
    const normalizedProfileTitle = profileTitle.trim();

    setSaving(true);
    setError(null);
    try {
      await onCreate({
        terminalId: normalizedTerminalId.length > 0 ? normalizedTerminalId : undefined,
        processKind: normalizedProcessKind.length > 0 ? normalizedProcessKind : undefined,
        command,
        cwd: normalizedCwd.length > 0 ? normalizedCwd : undefined,
        profile: {
          command: profileCommand,
          cwd: normalizedProfileCwd.length > 0 ? normalizedProfileCwd : undefined,
          cols,
          rows,
          gitLog:
            profileGitLog === "none" || profileGitLog === "normal" || profileGitLog === "verbose"
              ? profileGitLog
              : undefined,
          logStyle: profileLogStyle === "plain" || profileLogStyle === "rich" ? profileLogStyle : undefined,
          icon: normalizedProfileIcon.length > 0 ? normalizedProfileIcon : undefined,
          title: normalizedProfileTitle.length > 0 ? normalizedProfileTitle : undefined,
          shortcuts: profileShortcuts,
        },
        focus,
      });
      onClose();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Create terminal"
      description="Create a runtime terminal and optional profile overrides."
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
          <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
            {saving ? "Creating..." : "Create terminal"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-id">
              Terminal ID
            </label>
            <Input
              id="terminal-create-id"
              value={terminalId}
              onChange={(event) => setTerminalId(event.currentTarget.value)}
              placeholder="iflow-main"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-process-kind">
              Process kind
            </label>
            <Input
              id="terminal-create-process-kind"
              value={processKind}
              onChange={(event) => setProcessKind(event.currentTarget.value)}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-command">
            Command JSON array
          </label>
          <Textarea
            id="terminal-create-command"
            className="min-h-20 font-mono text-xs"
            value={commandDraft}
            onChange={(event) => setCommandDraft(event.currentTarget.value)}
            placeholder='["bash","-i"]'
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-cwd">
            Working directory
          </label>
          <Input id="terminal-create-cwd" value={cwd} onChange={(event) => setCwd(event.currentTarget.value)} />
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-700">
          <Checkbox checked={focus} onChange={(event) => setFocus(event.currentTarget.checked)} />
          Focus terminal after create
        </label>

        <Accordion type="single" collapsible className="rounded-xl border border-slate-200 bg-slate-50 px-3">
          <AccordionItem value="advanced" className="border-b-0">
            <AccordionTrigger className="py-3 text-sm font-medium text-slate-800 hover:no-underline">
              Advanced profile overrides
            </AccordionTrigger>
            <AccordionContent className="pb-3">
              <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-command">
                Profile command JSON array
              </label>
              <Textarea
                id="terminal-create-profile-command"
                className="min-h-20 font-mono text-xs"
                value={profileCommandDraft}
                onChange={(event) => setProfileCommandDraft(event.currentTarget.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-cwd">
                Profile working directory
              </label>
              <Input
                id="terminal-create-profile-cwd"
                value={profileCwd}
                onChange={(event) => setProfileCwd(event.currentTarget.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-cols">
                  Cols
                </label>
                <Input
                  id="terminal-create-profile-cols"
                  value={profileCols}
                  onChange={(event) => setProfileCols(event.currentTarget.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-rows">
                  Rows
                </label>
                <Input
                  id="terminal-create-profile-rows"
                  value={profileRows}
                  onChange={(event) => setProfileRows(event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-gitlog">
                  Git log
                </label>
                <Select
                  id="terminal-create-profile-gitlog"
                  value={profileGitLog}
                  onChange={(event) => setProfileGitLog(event.currentTarget.value)}
                >
                  <option value="">inherit</option>
                  <option value="none">none</option>
                  <option value="normal">normal</option>
                  <option value="verbose">verbose</option>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-log-style">
                  Log style
                </label>
                <Select
                  id="terminal-create-profile-log-style"
                  value={profileLogStyle}
                  onChange={(event) => setProfileLogStyle(event.currentTarget.value)}
                >
                  <option value="">inherit</option>
                  <option value="plain">plain</option>
                  <option value="rich">rich</option>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-icon">
                  Icon
                </label>
                <Input
                  id="terminal-create-profile-icon"
                  value={profileIcon}
                  onChange={(event) => setProfileIcon(event.currentTarget.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-title">
                  Title
                </label>
                <Input
                  id="terminal-create-profile-title"
                  value={profileTitle}
                  onChange={(event) => setProfileTitle(event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-create-profile-shortcuts">
                Shortcuts JSON object
              </label>
              <Textarea
                id="terminal-create-profile-shortcuts"
                className="min-h-20 font-mono text-xs"
                value={profileShortcutsDraft}
                onChange={(event) => setProfileShortcutsDraft(event.currentTarget.value)}
                placeholder='{"submit":"enter","newline":"shift+enter"}'
              />
            </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      </div>
    </Dialog>
  );
};

import type { SettingsKind } from "@agenter/app-server";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

interface EditableFile {
  path: string;
  content: string;
  mtimeMs: number;
}

interface SettingsPanelProps {
  kind: SettingsKind;
  content: string;
  status: string;
  disabled: boolean;
  onKindChange: (kind: SettingsKind) => void;
  onContentChange: (content: string) => void;
  onLoad: () => void;
  onSave: () => void;
}

export const SettingsPanel = ({
  kind,
  content,
  status,
  disabled,
  onKindChange,
  onContentChange,
  onLoad,
  onSave,
}: SettingsPanelProps) => {
  return (
    <Card className="col-span-1 lg:col-span-3">
      <CardHeader className="border-b border-slate-200">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Settings & Prompts</CardTitle>
          <Badge variant="secondary" className="max-w-[55ch] truncate">
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto]">
          <Select value={kind} onChange={(event) => onKindChange(event.target.value as SettingsKind)} disabled={disabled}>
          <option value="settings">settings.json</option>
          <option value="agenter">AGENTER.mdx</option>
          <option value="system">AGENTER_SYSTEM.mdx</option>
          <option value="template">SYSTEM_TEMPLATE.mdx</option>
          <option value="contract">RESPONSE_CONTRACT.mdx</option>
          </Select>
          <Button onClick={onLoad} disabled={disabled} variant="secondary">
          Load
          </Button>
          <Button onClick={onSave} disabled={disabled}>
          Save
          </Button>
        </div>
        <Textarea
          value={content}
          onChange={(event) => onContentChange(event.target.value)}
          placeholder="Load a file to edit settings or prompts"
          disabled={disabled}
          className="min-h-[260px] font-mono text-xs"
        />
      </CardContent>
    </Card>
  );
};

export type { EditableFile };

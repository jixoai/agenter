import type { SettingsKind } from "@agenter/app-server";

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
    <section className="panel panel--settings">
      <header className="panel__header">
        <h2>Settings & Prompts</h2>
        <span className="status">{status}</span>
      </header>
      <div className="panel__actions">
        <select value={kind} onChange={(event) => onKindChange(event.target.value as SettingsKind)} disabled={disabled}>
          <option value="settings">settings.json</option>
          <option value="agenter">AGENTER.mdx</option>
          <option value="system">AGENTER_SYSTEM.mdx</option>
          <option value="template">SYSTEM_TEMPLATE.mdx</option>
          <option value="contract">RESPONSE_CONTRACT.mdx</option>
        </select>
        <button onClick={onLoad} disabled={disabled}>
          Load
        </button>
        <button onClick={onSave} disabled={disabled}>
          Save
        </button>
      </div>
      <textarea
        className="settings-editor"
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="Load a file to edit settings or prompts"
        disabled={disabled}
      />
    </section>
  );
};

export type { EditableFile };

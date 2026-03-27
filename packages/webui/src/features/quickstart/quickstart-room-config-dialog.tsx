import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";
import type { QuickstartRoomConfig } from "./quickstart-bootstrap-types";

type ParticipantRole = "avatar" | "user" | "system";

interface ParticipantDraft {
  key: string;
  id: string;
  label: string;
  role: ParticipantRole;
}

interface QuickstartRoomConfigDialogProps {
  open: boolean;
  value: QuickstartRoomConfig;
  ownerHint: string;
  onClose: () => void;
  onSave: (value: QuickstartRoomConfig) => Promise<void> | void;
}

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseMetadata = (value: string): Record<string, unknown> => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Metadata must be a JSON object.");
  }
  return parsed;
};

const createToken = (): string => {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789._-";
  const bytes = new Uint8Array(24);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 255);
    }
  }
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
};

const toRole = (value: string): ParticipantRole => {
  if (value === "avatar" || value === "system") {
    return value;
  }
  return "user";
};

const buildParticipantDrafts = (value: QuickstartRoomConfig, ownerHint: string): ParticipantDraft[] => {
  if (value.participants.length > 0) {
    return value.participants.map((participant, index) => ({
      key: `${participant.id}-${index}`,
      id: participant.id,
      label: participant.label ?? "",
      role: participant.role ?? "user",
    }));
  }
  const owner = ownerHint.trim() || "agenter";
  return [
    {
      key: `owner-${owner}`,
      id: `avatar:${owner}`,
      label: owner,
      role: "avatar",
    },
    {
      key: "user-default",
      id: "user",
      label: "User",
      role: "user",
    },
  ];
};

export const QuickstartRoomConfigDialog = ({
  open,
  value,
  ownerHint,
  onClose,
  onSave,
}: QuickstartRoomConfigDialogProps) => {
  const [title, setTitle] = useState(value.title);
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() => buildParticipantDrafts(value, ownerHint));
  const [metadataDraft, setMetadataDraft] = useState(() => JSON.stringify(value.metadata, null, 2));
  const [adminToken, setAdminToken] = useState(value.adminToken);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(value.title);
    setParticipants(buildParticipantDrafts(value, ownerHint));
    setMetadataDraft(JSON.stringify(value.metadata, null, 2));
    setAdminToken(value.adminToken);
    setError(null);
  }, [open, ownerHint, value]);

  const normalizedParticipants = useMemo(
    () =>
      participants
        .map((participant) => ({
          id: participant.id.trim(),
          label: participant.label.trim(),
          role: participant.role,
        }))
        .filter((participant) => participant.id.length > 0)
        .map((participant) => ({
          id: participant.id,
          label: participant.label.length > 0 ? participant.label : undefined,
          role: participant.role,
        })),
    [participants],
  );

  const handleSave = async () => {
    const normalizedTitle = title.trim();
    if (normalizedTitle.length === 0) {
      setError("Title is required.");
      return;
    }
    if (normalizedParticipants.length === 0) {
      setError("At least one participant is required.");
      return;
    }
    const normalizedAdminToken = adminToken.trim();
    if (normalizedAdminToken.length > 0 && !ACCESS_TOKEN_PATTERN.test(normalizedAdminToken)) {
      setError("Admin token must be 16-128 chars [A-Za-z0-9._-].");
      return;
    }
    let metadata: Record<string, unknown>;
    try {
      metadata = parseMetadata(metadataDraft);
    } catch (metadataError) {
      setError(metadataError instanceof Error ? metadataError.message : String(metadataError));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: normalizedTitle,
        participants: normalizedParticipants,
        metadata,
        adminToken: normalizedAdminToken,
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
      title="Chat room config"
      description="Configure chat-main metadata used by the next Quick Start session."
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
            {saving ? "Saving..." : "Save room config"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="quickstart-room-title">
              Room title
            </label>
            <Input id="quickstart-room-title" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="quickstart-room-metadata">
              Metadata JSON
            </label>
            <Textarea
              id="quickstart-room-metadata"
              className="min-h-24"
              value={metadataDraft}
              onChange={(event) => setMetadataDraft(event.currentTarget.value)}
            />
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">Participants</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                idRef.current += 1;
                setParticipants((current) => [
                  ...current,
                  {
                    key: `new-${idRef.current}`,
                    id: "",
                    label: "",
                    role: "user",
                  },
                ]);
              }}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="space-y-2">
            {participants.map((participant, index) => (
              <div
                key={participant.key}
                className="grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_8rem_auto]"
              >
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600" htmlFor={`quickstart-room-label-${participant.key}`}>
                    Label
                  </label>
                  <Input
                    id={`quickstart-room-label-${participant.key}`}
                    value={participant.label}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setParticipants((current) =>
                        current.map((entry) => (entry.key === participant.key ? { ...entry, label: nextValue } : entry)),
                      );
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600" htmlFor={`quickstart-room-id-${participant.key}`}>
                    Participant ID
                  </label>
                  <Input
                    id={`quickstart-room-id-${participant.key}`}
                    value={participant.id}
                    onChange={(event) => {
                      const nextValue = event.currentTarget.value;
                      setParticipants((current) =>
                        current.map((entry) => (entry.key === participant.key ? { ...entry, id: nextValue } : entry)),
                      );
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600" htmlFor={`quickstart-room-role-${participant.key}`}>
                    Role
                  </label>
                  <Select
                    id={`quickstart-room-role-${participant.key}`}
                    value={participant.role}
                    onChange={(event) => {
                      const nextRole = toRole(event.currentTarget.value);
                      setParticipants((current) =>
                        current.map((entry) => (entry.key === participant.key ? { ...entry, role: nextRole } : entry)),
                      );
                    }}
                  >
                    <option value="avatar">avatar</option>
                    <option value="user">user</option>
                    <option value="system">system</option>
                  </Select>
                </div>
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove participant ${index + 1}`}
                    onClick={() => {
                      setParticipants((current) => current.filter((entry) => entry.key !== participant.key));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="quickstart-room-admin-token">
              Admin token
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="quickstart-room-admin-token"
                value={adminToken}
                onChange={(event) => setAdminToken(event.currentTarget.value)}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setAdminToken(createToken());
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Generate
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">Leave empty to let backend generate chat-main admin token.</p>
          </div>
        </section>

        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      </div>
    </Dialog>
  );
};

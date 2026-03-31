import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Textarea } from "../../components/ui/textarea";

type ParticipantRole = "avatar" | "user" | "system";

interface ParticipantDraft {
  key: string;
  id: string;
  label: string;
  role: ParticipantRole;
}

export interface MessageChannelCreateInput {
  title: string;
  participants: Array<{ id: string; label?: string; role?: ParticipantRole }>;
  metadata?: Record<string, unknown>;
  adminToken?: string;
}

interface MessageChannelCreateDialogProps {
  open: boolean;
  ownerHint: string;
  existingCount: number;
  onClose: () => void;
  onCreate: (input: MessageChannelCreateInput) => Promise<void> | void;
}

const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9._-]{16,128}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseMetadataDraft = (input: string): Record<string, unknown> => {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Metadata must be a JSON object.");
  }
  return parsed;
};

const defaultTitle = (existingCount: number): string => {
  const number = Math.max(1, existingCount + 1);
  return `Room ${number}`;
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

const toParticipantDefaults = (ownerHint: string): ParticipantDraft[] => {
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

const toParticipantRole = (value: string): ParticipantRole => {
  if (value === "avatar" || value === "system") {
    return value;
  }
  return "user";
};

export const MessageChannelCreateDialog = ({
  open,
  ownerHint,
  existingCount,
  onClose,
  onCreate,
}: MessageChannelCreateDialogProps) => {
  const [title, setTitle] = useState(() => defaultTitle(existingCount));
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() => toParticipantDefaults(ownerHint));
  const [metadataDraft, setMetadataDraft] = useState("{}\n");
  const [adminToken, setAdminToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const idRef = useRef(0);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(defaultTitle(existingCount));
    setParticipants(toParticipantDefaults(ownerHint));
    setMetadataDraft("{}\n");
    setAdminToken("");
    setError(null);
  }, [existingCount, open, ownerHint]);

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

  const handleCreate = async () => {
    const nextTitle = title.trim();
    if (nextTitle.length === 0) {
      setError("Title is required.");
      return;
    }
    if (normalizedParticipants.length === 0) {
      setError("At least one participant is required.");
      return;
    }

    let metadata: Record<string, unknown>;
    try {
      metadata = parseMetadataDraft(metadataDraft);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : String(parseError));
      return;
    }

    const normalizedToken = adminToken.trim();
    if (normalizedToken.length > 0 && !ACCESS_TOKEN_PATTERN.test(normalizedToken)) {
      setError("Admin token must be 16-128 chars [A-Za-z0-9._-].");
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await onCreate({
        title: nextTitle,
        participants: normalizedParticipants,
        metadata,
        adminToken: normalizedToken.length > 0 ? normalizedToken : undefined,
      });
      onClose();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Create room"
      description="Configure room metadata, participants, and optional admin credentials before creation."
      onClose={() => {
        if (creating) {
          return;
        }
        onClose();
      }}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleCreate()} disabled={creating}>
            {creating ? "Creating..." : "Create room"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="channel-create-title">
              Title
            </label>
            <Input id="channel-create-title" value={title} onChange={(event) => setTitle(event.currentTarget.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-700" htmlFor="channel-create-metadata">
              Metadata JSON
            </label>
            <Textarea
              id="channel-create-metadata"
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
                  <label className="text-[11px] font-medium text-slate-600" htmlFor={`participant-label-${participant.key}`}>
                    Label
                  </label>
                  <Input
                    id={`participant-label-${participant.key}`}
                    aria-label={`Participant label ${index + 1}`}
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
                  <label className="text-[11px] font-medium text-slate-600" htmlFor={`participant-id-${participant.key}`}>
                    Participant ID
                  </label>
                  <Input
                    id={`participant-id-${participant.key}`}
                    aria-label={`Participant id ${index + 1}`}
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
                  <label className="text-[11px] font-medium text-slate-600" htmlFor={`participant-role-${participant.key}`}>
                    Role
                  </label>
                  <Select
                    id={`participant-role-${participant.key}`}
                    aria-label={`Participant role ${index + 1}`}
                    value={participant.role}
                    onChange={(event) => {
                      const nextRole = toParticipantRole(event.currentTarget.value);
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
            <label className="text-xs font-medium text-slate-700" htmlFor="channel-create-admin-token">
              Admin token (optional)
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="channel-create-admin-token"
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
            <p className="text-[11px] text-slate-500">Leave empty to let backend generate a secure token.</p>
          </div>
        </section>

        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      </div>
    </Dialog>
  );
};

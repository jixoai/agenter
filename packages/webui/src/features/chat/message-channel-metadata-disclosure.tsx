import type { MessageChannelEntry, MessageChannelGrantEntry, MessageChannelGrantIssueOutput } from "@agenter/client-sdk";
import { CircleDot, Copy, Info, MessageCircleMore, Plus, Signal, Trash2, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { SurfaceSignalDisclosure } from "../../components/ui/surface-signal-disclosure";
import { Textarea } from "../../components/ui/textarea";

type ParticipantRole = "avatar" | "user" | "system";
type GrantRole = "admin" | "member" | "readonly";

interface ParticipantDraft {
  key: string;
  id: string;
  label: string;
  role: ParticipantRole;
}

interface MessageChannelMetadataDisclosureProps {
  channel: MessageChannelEntry;
  onFocusChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onArchiveChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onUpdateChannel?: (input: {
    channel: MessageChannelEntry;
    patch: {
      title?: string;
      participants?: Array<{ id: string; label?: string; role?: ParticipantRole }>;
      metadata?: Record<string, unknown>;
    };
  }) => Promise<MessageChannelEntry>;
  onListChannelGrants?: (channel: MessageChannelEntry) => Promise<MessageChannelGrantEntry[]>;
  onIssueChannelGrant?: (input: {
    channel: MessageChannelEntry;
    role: GrantRole;
    label?: string;
    participantId?: string;
  }) => Promise<MessageChannelGrantIssueOutput["grant"]>;
  onRevokeChannelGrant?: (input: { channel: MessageChannelEntry; grantId: string }) => Promise<{ ok: boolean }>;
}

const rowTone = (channel: MessageChannelEntry): "neutral" | "active" | "warning" => {
  if (!channel.transportUrl) {
    return "warning";
  }
  return channel.focused ? "active" : "neutral";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toParticipantDrafts = (channel: MessageChannelEntry): ParticipantDraft[] =>
  channel.participants.map((participant, index) => ({
    key: `${participant.id || "participant"}-${index}-${channel.updatedAt}`,
    id: participant.id,
    label: participant.label ?? "",
    role: participant.role ?? "user",
  }));

const toMetadataDraft = (metadata: MessageChannelEntry["metadata"]): string => JSON.stringify(metadata ?? {}, null, 2);

const parseMetadataDraft = (value: string): Record<string, unknown> => {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return {};
  }
  const parsed = JSON.parse(trimmed) as unknown;
  if (!isRecord(parsed)) {
    throw new Error("Channel metadata must be a JSON object.");
  }
  return parsed;
};

const toParticipantRole = (value: string): ParticipantRole =>
  value === "avatar" || value === "system" ? value : "user";

const toGrantRole = (value: string): GrantRole =>
  value === "admin" || value === "member" ? value : "readonly";

const FieldRow = ({ label, value }: { label: string; value: string }) => (
  <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-2 text-xs">
    <span className="text-slate-500">{label}</span>
    <span className="min-w-0 break-words text-slate-900">{value}</span>
  </div>
);

const Section = ({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CircleDot;
  children: ReactNode;
}) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-3">
    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
      <Icon className="h-4 w-4 text-slate-600" />
      <span>{title}</span>
    </div>
    {children}
  </section>
);

export const MessageChannelMetadataDisclosure = ({
  channel,
  onFocusChannel,
  onArchiveChannel,
  onUpdateChannel,
  onListChannelGrants,
  onIssueChannelGrant,
  onRevokeChannelGrant,
}: MessageChannelMetadataDisclosureProps) => {
  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(channel.title);
  const [participantDrafts, setParticipantDrafts] = useState<ParticipantDraft[]>(() => toParticipantDrafts(channel));
  const [metadataDraft, setMetadataDraft] = useState(() => toMetadataDraft(channel.metadata));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [grants, setGrants] = useState<MessageChannelGrantEntry[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantsError, setGrantsError] = useState<string | null>(null);
  const [grantRole, setGrantRole] = useState<GrantRole>("readonly");
  const [grantLabel, setGrantLabel] = useState("");
  const [grantParticipantId, setGrantParticipantId] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [issuedGrant, setIssuedGrant] = useState<MessageChannelGrantIssueOutput["grant"] | null>(null);
  const [revokingGrantId, setRevokingGrantId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [focusing, setFocusing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const isAdmin = channel.accessRole === "admin";
  const isBuiltIn =
    channel.chatId === "chat-main" ||
    (isRecord(channel.metadata) && typeof channel.metadata.builtIn === "boolean" && channel.metadata.builtIn === true);
  const ChannelIcon = channel.kind === "room" ? Users : MessageCircleMore;
  const transportState = channel.transportUrl ? (channel.focused ? "connected and focused" : "connected") : "offline";

  const loadGrants = useCallback(async () => {
    if (!isAdmin || !onListChannelGrants) {
      setGrants([]);
      setGrantsError(null);
      return;
    }
    setGrantsLoading(true);
    setGrantsError(null);
    try {
      setGrants(await onListChannelGrants(channel));
    } catch (error) {
      setGrantsError(error instanceof Error ? error.message : String(error));
    } finally {
      setGrantsLoading(false);
    }
  }, [channel, isAdmin, onListChannelGrants]);

  useEffect(() => {
    setDraftTitle(channel.title);
    setParticipantDrafts(toParticipantDrafts(channel));
    setMetadataDraft(toMetadataDraft(channel.metadata));
    setFormError(null);
    setFocusing(false);
    setArchiving(false);
    setIssuedGrant(null);
    setCopyFeedback(null);
  }, [channel]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadGrants();
  }, [loadGrants, open]);

  const canEditChannel = isAdmin && Boolean(onUpdateChannel);
  const canManageGrants = isAdmin && Boolean(onIssueChannelGrant) && Boolean(onRevokeChannelGrant);
  const canFocusChannel = isAdmin && Boolean(onFocusChannel);
  const canArchiveChannel = isAdmin && Boolean(onArchiveChannel) && !isBuiltIn;

  const normalizedParticipants = useMemo(
    () =>
      participantDrafts
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
    [participantDrafts],
  );

  const handleSave = useCallback(async () => {
    if (!canEditChannel || !onUpdateChannel) {
      return;
    }
    const nextTitle = draftTitle.trim();
    if (nextTitle.length === 0) {
      setFormError("Channel title is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const metadata = parseMetadataDraft(metadataDraft);
      const updated = await onUpdateChannel({
        channel,
        patch: {
          title: nextTitle,
          participants: normalizedParticipants,
          metadata,
        },
      });
      setDraftTitle(updated.title);
      setParticipantDrafts(toParticipantDrafts(updated));
      setMetadataDraft(toMetadataDraft(updated.metadata));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }, [canEditChannel, channel, draftTitle, metadataDraft, normalizedParticipants, onUpdateChannel]);

  const handleIssueGrant = useCallback(async () => {
    if (!canManageGrants || !onIssueChannelGrant) {
      return;
    }
    setIssuing(true);
    setGrantsError(null);
    try {
      const grant = await onIssueChannelGrant({
        channel,
        role: grantRole,
        label: grantLabel.trim() || undefined,
        participantId: grantParticipantId.trim() || undefined,
      });
      setIssuedGrant(grant);
      setGrantLabel("");
      setGrantParticipantId("");
      await loadGrants();
    } catch (error) {
      setGrantsError(error instanceof Error ? error.message : String(error));
    } finally {
      setIssuing(false);
    }
  }, [canManageGrants, channel, grantLabel, grantParticipantId, grantRole, loadGrants, onIssueChannelGrant]);

  const handleRevokeGrant = useCallback(
    async (grantId: string) => {
      if (!canManageGrants || !onRevokeChannelGrant) {
        return;
      }
      setRevokingGrantId(grantId);
      setGrantsError(null);
      try {
        await onRevokeChannelGrant({ channel, grantId });
        await loadGrants();
      } catch (error) {
        setGrantsError(error instanceof Error ? error.message : String(error));
      } finally {
        setRevokingGrantId(null);
      }
    },
    [canManageGrants, channel, loadGrants, onRevokeChannelGrant],
  );

  const handleCopyIssuedToken = useCallback(async () => {
    if (!issuedGrant?.accessToken || typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      return;
    }
    await navigator.clipboard.writeText(issuedGrant.accessToken);
    setCopyFeedback("Token copied.");
  }, [issuedGrant?.accessToken]);

  const handleFocusChannel = useCallback(async () => {
    if (!canFocusChannel || !onFocusChannel) {
      return;
    }
    setFocusing(true);
    setFormError(null);
    try {
      await onFocusChannel(channel);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setFocusing(false);
    }
  }, [canFocusChannel, channel, onFocusChannel]);

  const handleArchiveChannel = useCallback(async () => {
    if (!canArchiveChannel || !onArchiveChannel) {
      return;
    }
    setArchiving(true);
    setFormError(null);
    try {
      await onArchiveChannel(channel);
      setOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setArchiving(false);
    }
  }, [canArchiveChannel, channel, onArchiveChannel]);

  return (
    <SurfaceSignalDisclosure
      icon={Info}
      tone={rowTone(channel)}
      label={`Open details for ${channel.title}`}
      title={channel.title}
      description={channel.kind === "room" ? "Room metadata" : "Direct chat metadata"}
      testId="message-channel-metadata-trigger"
      contentClassName="text-sm"
      open={open}
      onOpenChange={setOpen}
    >
      <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Channel" icon={ChannelIcon}>
          <div className="space-y-2.5">
            <FieldRow label="ID" value={channel.chatId} />
            <FieldRow label="Kind" value={channel.kind === "room" ? "Room" : "Direct chat"} />
            <FieldRow label="Owner" value={channel.owner} />
            <FieldRow label="Role" value={channel.accessRole} />
            <FieldRow label="Status" value={transportState} />
            <FieldRow label="Created" value={new Date(channel.createdAt).toLocaleString()} />
            <FieldRow label="Updated" value={new Date(channel.updatedAt).toLocaleString()} />
          </div>
        </Section>

        <Section title="Runtime" icon={Signal}>
          <div className="space-y-2.5">
            <FieldRow label="Transport" value={channel.transportUrl ?? "Not available"} />
            <FieldRow label="Focused" value={channel.focused ? "Yes" : "No"} />
            <FieldRow label="Context" value={channel.contextId ?? "Not bound"} />
            {isAdmin ? (
              <div className="pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canFocusChannel || focusing}
                    onClick={() => void handleFocusChannel()}
                  >
                    {channel.focused ? "Unfocus channel" : "Focus channel"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canArchiveChannel || archiving}
                    onClick={() => void handleArchiveChannel()}
                  >
                    Archive channel
                  </Button>
                </div>
                {!canArchiveChannel ? (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {isBuiltIn ? "Built-in chat-main channel cannot be archived." : "Archive requires admin access."}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </Section>
      </section>

      <Section title="Participants" icon={CircleDot}>
        <div className="space-y-2">
          {participantDrafts.map((participant, index) => (
            <div
              key={participant.key}
              className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_auto]"
            >
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-600" htmlFor={`participant-label-${participant.key}`}>
                  Label
                </label>
                <Input
                  id={`participant-label-${participant.key}`}
                  aria-label={`Participant label ${index + 1}`}
                  value={participant.label}
                  readOnly={!canEditChannel}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;
                    setParticipantDrafts((current) =>
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
                  readOnly={!canEditChannel}
                  onChange={(event) => {
                    const nextValue = event.currentTarget.value;
                    setParticipantDrafts((current) =>
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
                  disabled={!canEditChannel}
                  value={participant.role}
                  onChange={(event) => {
                    const nextRole = toParticipantRole(event.currentTarget.value);
                    setParticipantDrafts((current) =>
                      current.map((entry) => (entry.key === participant.key ? { ...entry, role: nextRole } : entry)),
                    );
                  }}
                >
                  <option value="avatar">avatar</option>
                  <option value="user">user</option>
                  <option value="system">system</option>
                </Select>
              </div>
              {canEditChannel ? (
                <div className="flex items-end justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove participant ${index + 1}`}
                    onClick={() => {
                      setParticipantDrafts((current) => current.filter((entry) => entry.key !== participant.key));
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {canEditChannel ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setParticipantDrafts((current) => [
                  ...current,
                  { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, id: "", label: "", role: "user" },
                ]);
              }}
            >
              <Plus className="h-4 w-4" />
              Add participant
            </Button>
          ) : null}
        </div>
      </Section>

      <Section title={isAdmin ? "Admin" : "Access"} icon={Info}>
        {isAdmin ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Title</label>
                <Input
                  aria-label="Channel title"
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.currentTarget.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Metadata JSON</label>
                <Textarea
                  aria-label="Channel metadata JSON"
                  className="min-h-28"
                  value={metadataDraft}
                  onChange={(event) => setMetadataDraft(event.currentTarget.value)}
                />
              </div>
            </div>
            {formError ? <p className="text-xs text-rose-700">{formError}</p> : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={() => void handleSave()} disabled={!canEditChannel || saving}>
                Save channel
              </Button>
              <span className="text-xs text-slate-500">Admins can edit title, participants, and metadata.</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">This channel is currently read-only for metadata and grant management.</p>
        )}
      </Section>

      {isAdmin ? (
        <Section title="Token grants" icon={Users}>
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[8rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Select aria-label="Grant role" value={grantRole} onChange={(event) => setGrantRole(toGrantRole(event.currentTarget.value))}>
                <option value="readonly">readonly</option>
                <option value="member">member</option>
                <option value="admin">admin</option>
              </Select>
              <Input
                aria-label="Grant label"
                value={grantLabel}
                onChange={(event) => setGrantLabel(event.currentTarget.value)}
                placeholder="Viewer label"
              />
              <Input
                aria-label="Grant participant"
                value={grantParticipantId}
                onChange={(event) => setGrantParticipantId(event.currentTarget.value)}
                placeholder="user:gaubee"
              />
              <Button type="button" size="sm" onClick={() => void handleIssueGrant()} disabled={!canManageGrants || issuing}>
                Issue token
              </Button>
            </div>

            {issuedGrant ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                <div className="mb-2 font-medium">Issued {issuedGrant.role} token</div>
                <div className="break-all font-mono">{issuedGrant.accessToken}</div>
                {issuedGrant.transportUrl ? <div className="mt-2 break-all text-emerald-800/80">{issuedGrant.transportUrl}</div> : null}
                <div className="mt-2 flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleCopyIssuedToken()}>
                    <Copy className="h-4 w-4" />
                    Copy token
                  </Button>
                  {copyFeedback ? <span>{copyFeedback}</span> : null}
                </div>
              </div>
            ) : null}

            {grantsError ? <p className="text-xs text-rose-700">{grantsError}</p> : null}
            {grantsLoading ? <p className="text-xs text-slate-500">Loading grants...</p> : null}
            {!grantsLoading && grants.length === 0 ? (
              <p className="text-xs text-slate-500">No issued grants yet.</p>
            ) : (
              <ul className="space-y-2">
                {grants.map((grant) => (
                  <li key={grant.grantId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900">
                        {grant.label ?? grant.participantId ?? grant.grantId}
                      </div>
                      <div className="truncate text-slate-500">
                        {grant.role} · {grant.participantId ?? "no participant"} · {new Date(grant.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={!canManageGrants || revokingGrantId === grant.grantId}
                      onClick={() => void handleRevokeGrant(grant.grantId)}
                    >
                      Revoke
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Section>
      ) : null}
    </SurfaceSignalDisclosure>
  );
};

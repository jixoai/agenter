import type { MessageChannelEntry, MessageChannelGrantEntry, MessageChannelGrantIssueOutput } from "@agenter/client-sdk";
import { CircleDot, Copy, Info, Signal, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { SurfaceSignalDisclosure } from "../../components/ui/surface-signal-disclosure";
import { Textarea } from "../../components/ui/textarea";
import { RoomParticipantEditor } from "./RoomParticipantEditor";
import {
  normalizeRoomParticipants,
  toRoomParticipantDrafts,
  type RoomActorOption,
  type RoomParticipantDraft,
  type RoomParticipantInput,
} from "./room-participants";

type GrantRole = "admin" | "member" | "readonly";

interface MessageChannelMetadataDisclosureProps {
  channel: MessageChannelEntry;
  onArchiveChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onDeleteChannel?: (channel: MessageChannelEntry) => Promise<void> | void;
  onUpdateChannel?: (input: {
    channel: MessageChannelEntry;
    patch: {
      title?: string;
      participants?: RoomParticipantInput[];
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
  actorOptions?: RoomActorOption[];
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
  onArchiveChannel,
  onDeleteChannel,
  onUpdateChannel,
  onListChannelGrants,
  onIssueChannelGrant,
  actorOptions = [],
  onRevokeChannelGrant,
}: MessageChannelMetadataDisclosureProps) => {
  const [open, setOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(channel.title);
  const [participantDrafts, setParticipantDrafts] = useState<RoomParticipantDraft[]>(() =>
    toRoomParticipantDrafts(channel.participants, channel.updatedAt),
  );
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
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const actorMeta = useMemo(() => new Map(actorOptions.map((option) => [option.actorId, option])), [actorOptions]);

  const isAdmin = channel.accessRole === "admin";
  const ChannelIcon = Users;
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
    setParticipantDrafts(toRoomParticipantDrafts(channel.participants, channel.updatedAt));
    setMetadataDraft(toMetadataDraft(channel.metadata));
    setFormError(null);
    setArchiving(false);
    setDeleting(false);
    setIssuedGrant(null);
    setCopyFeedback(null);
  }, [channel.accessRole, channel.chatId, channel.participantId, channel.updatedAt]);

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadGrants();
  }, [loadGrants, open]);

  const canEditChannel = isAdmin && Boolean(onUpdateChannel);
  const canManageGrants = isAdmin && Boolean(onIssueChannelGrant) && Boolean(onRevokeChannelGrant);
  const canArchiveChannel = isAdmin && Boolean(onArchiveChannel);
  const canDeleteChannel = isAdmin && Boolean(onDeleteChannel);

  const normalizedParticipants = useMemo(
    () => normalizeRoomParticipants(participantDrafts, actorOptions),
    [actorOptions, participantDrafts],
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
      setParticipantDrafts(toRoomParticipantDrafts(updated.participants, updated.updatedAt));
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

  const handleDeleteChannel = useCallback(async () => {
    if (!canDeleteChannel || !onDeleteChannel) {
      return;
    }
    setDeleting(true);
    setFormError(null);
    try {
      await onDeleteChannel(channel);
      setOpen(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeleting(false);
    }
  }, [canDeleteChannel, channel, onDeleteChannel]);

  return (
    <SurfaceSignalDisclosure
      icon={Info}
      tone={rowTone(channel)}
      label={`Open details for ${channel.title}`}
      title={channel.title}
      description="Room metadata"
      testId="message-channel-metadata-trigger"
      contentClassName="text-sm"
      open={open}
      onOpenChange={setOpen}
    >
      <section className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section title="Channel" icon={ChannelIcon}>
          <div className="space-y-2.5">
            <FieldRow label="ID" value={channel.chatId} />
            <FieldRow label="Kind" value="Room" />
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
            <FieldRow label="Seat focus" value={channel.focused ? "Focused" : "Not focused"} />
            <FieldRow label="Context" value={channel.contextId ?? "Not bound"} />
            {isAdmin ? (
              <div className="pt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!canArchiveChannel || archiving}
                    onClick={() => void handleArchiveChannel()}
                  >
                    Archive channel
                  </Button>
                  {onDeleteChannel ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={!canDeleteChannel || deleting}
                      onClick={() => void handleDeleteChannel()}
                    >
                      Dissolve room
                    </Button>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {onDeleteChannel && canDeleteChannel
                    ? "Dissolve removes the room record, grants, read state, and transcript."
                    : "Archive requires admin access."}
                </p>
              </div>
            ) : null}
          </div>
        </Section>
      </section>

      <Section title="Participants" icon={CircleDot}>
        <div className="space-y-2">
          <p className="text-[11px] text-slate-500">Room seats reference auth or session actors. Labels and avatars stay upstream in auth-system.</p>
          <RoomParticipantEditor
            participants={participantDrafts}
            actorOptions={actorOptions}
            canEdit={canEditChannel}
            fieldIdPrefix="message-channel-participant"
            onActorChange={(key, actorId) => {
              setParticipantDrafts((current) => current.map((entry) => (entry.key === key ? { ...entry, id: actorId } : entry)));
            }}
            onRemove={(key) => {
              setParticipantDrafts((current) => current.filter((entry) => entry.key !== key));
            }}
            onAdd={
              canEditChannel
                ? () => {
                    setParticipantDrafts((current) => [
                      ...current,
                      { key: `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, id: "" },
                    ]);
                  }
                : undefined
            }
          />
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
              <Select aria-label="Grant participant" value={grantParticipantId} onChange={(event) => setGrantParticipantId(event.currentTarget.value)}>
                <option value="">Select actor</option>
                {actorOptions.map((option) => (
                  <option key={option.actorId} value={option.actorId}>
                    {[option.label, option.actorKind, option.subtitle].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </Select>
              <Input
                aria-label="Grant label"
                value={grantLabel}
                onChange={(event) => setGrantLabel(event.currentTarget.value)}
                placeholder="Viewer label"
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
                      <div className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                        <span>{grant.label ?? grant.participantId ?? grant.grantId}</span>
                        {grant.participantId ? (
                          <Badge variant="secondary">{actorMeta.get(grant.participantId)?.actorKind ?? "grant"}</Badge>
                        ) : null}
                      </div>
                      <div className="truncate text-slate-500">
                        {grant.role} · {grant.participantId ?? "no participant"} · {new Date(grant.createdAt).toLocaleString()}
                      </div>
                      {grant.participantId && actorMeta.get(grant.participantId)?.subtitle ? (
                        <div className="truncate text-slate-500">{actorMeta.get(grant.participantId)?.subtitle}</div>
                      ) : null}
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

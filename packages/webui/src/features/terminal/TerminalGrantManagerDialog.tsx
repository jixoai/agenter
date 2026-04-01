import type {
  GlobalTerminalActorId,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  GlobalTerminalGrantIssueOutput,
} from "@agenter/client-sdk";
import { Copy, KeyRound, Shield, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "../../components/ui/badge";
import { Button, ButtonLabel, ButtonLeadingVisual } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { cn } from "../../lib/utils";

export interface TerminalActorOption {
  actorId: GlobalTerminalActorId;
  actorKind: "auth" | "session";
  label: string;
  subtitle?: string;
}

interface TerminalGrantManagerDialogProps {
  open: boolean;
  terminal: GlobalTerminalEntry | null;
  actorOptions: TerminalActorOption[];
  onClose: () => void;
  onListGrants: (terminalId: string) => Promise<GlobalTerminalGrantEntry[]>;
  onIssueGrant: (input: {
    terminalId: string;
    role: "admin" | "writer" | "requester" | "readonly";
    participantId: GlobalTerminalActorId;
    label?: string;
    accessTokenHint?: string;
    adminCandidateRank?: number | null;
  }) => Promise<GlobalTerminalGrantIssueOutput["grant"]>;
  onRevokeGrant: (input: { terminalId: string; grantId: string }) => Promise<{ ok: boolean }>;
  onChanged: () => Promise<void> | void;
}

type GrantRole = "admin" | "writer" | "requester" | "readonly";

const roleOrder: Record<GrantRole, number> = {
  admin: 0,
  writer: 1,
  requester: 2,
  readonly: 3,
};

const parseCandidateRank = (value: string): number | null | undefined => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    return undefined;
  }
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("Admin candidate rank must be a non-negative integer.");
  }
  return parsed;
};

const fallbackActorLabel = (actorId: string): string => actorId.split(":").at(-1) ?? actorId;

export const TerminalGrantManagerDialog = ({
  open,
  terminal,
  actorOptions,
  onClose,
  onListGrants,
  onIssueGrant,
  onRevokeGrant,
  onChanged,
}: TerminalGrantManagerDialogProps) => {
  const [grants, setGrants] = useState<GlobalTerminalGrantEntry[]>([]);
  const [participantId, setParticipantId] = useState("");
  const [role, setRole] = useState<GrantRole>("readonly");
  const [label, setLabel] = useState("");
  const [accessTokenHint, setAccessTokenHint] = useState("");
  const [adminCandidateRank, setAdminCandidateRank] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedGrant, setIssuedGrant] = useState<GlobalTerminalGrantIssueOutput["grant"] | null>(null);
  const [downgradePromptOpen, setDowngradePromptOpen] = useState(false);

  const actorMeta = useMemo(() => {
    return new Map(actorOptions.map((option) => [option.actorId, option]));
  }, [actorOptions]);

  const load = async () => {
    if (!terminal) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await onListGrants(terminal.terminalId);
      setGrants(
        [...next].sort((left, right) => {
          const leftRank =
            terminal.actors?.find((actor) => actor.actorId === left.participantId)?.adminCandidateRank ?? Number.MAX_SAFE_INTEGER;
          const rightRank =
            terminal.actors?.find((actor) => actor.actorId === right.participantId)?.adminCandidateRank ?? Number.MAX_SAFE_INTEGER;
          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }
          const roleDiff = roleOrder[left.role] - roleOrder[right.role];
          if (roleDiff !== 0) {
            return roleDiff;
          }
          return (left.participantId ?? left.grantId).localeCompare(right.participantId ?? right.grantId);
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : String(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !terminal) {
      return;
    }
    setParticipantId("");
    setRole("readonly");
    setLabel("");
    setAccessTokenHint("");
    setAdminCandidateRank("");
    setIssuedGrant(null);
    setDowngradePromptOpen(false);
    void load();
  }, [open, terminal?.terminalId]);

  const otherWriterGrants = useMemo(
    () =>
      grants.filter(
        (grant) =>
          grant.role === "writer" &&
          grant.participantId &&
          grant.participantId !== (participantId.trim() as GlobalTerminalActorId),
      ),
    [grants, participantId],
  );

  const applyGrant = async (downgradeExistingWriters: boolean) => {
    if (!terminal) {
      return;
    }
    const normalizedParticipantId = participantId.trim();
    if (normalizedParticipantId.length === 0) {
      setError("Participant id is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (downgradeExistingWriters) {
        for (const grant of otherWriterGrants) {
          if (!grant.participantId) {
            continue;
          }
          await onRevokeGrant({
            terminalId: terminal.terminalId,
            grantId: grant.grantId,
          });
          await onIssueGrant({
            terminalId: terminal.terminalId,
            participantId: grant.participantId,
            role: "requester",
            label: grant.label,
            accessTokenHint: grant.accessToken,
          });
        }
      }

      const created = await onIssueGrant({
        terminalId: terminal.terminalId,
        participantId: normalizedParticipantId as GlobalTerminalActorId,
        role,
        label: label.trim() || undefined,
        accessTokenHint: accessTokenHint.trim() || undefined,
        adminCandidateRank: role === "admin" ? parseCandidateRank(adminCandidateRank) : undefined,
      });
      setIssuedGrant(created);
      await load();
      await onChanged();
      setParticipantId("");
      setLabel("");
      setAccessTokenHint("");
      setAdminCandidateRank("");
      setDowngradePromptOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : String(submitError));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (role === "writer" && otherWriterGrants.length > 0) {
      setDowngradePromptOpen(true);
      return;
    }
    await applyGrant(false);
  };

  return (
    <>
      <Dialog
        open={open}
        title={terminal ? `Access for ${terminal.title ?? terminal.terminalId}` : "Manage access"}
        description="Grant terminal seats to auth or session actors. Admin candidates are ordered by rank, where 0 is the highest priority."
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
            <Button type="button" onClick={() => void handleSubmit()} disabled={saving || !terminal}>
              {saving ? "Saving..." : "Issue grant"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}

          {issuedGrant?.accessToken ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-emerald-950">Issued credential</p>
                  <p className="break-all font-mono text-xs text-emerald-900">{issuedGrant.accessToken}</p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (typeof navigator === "undefined" || !navigator.clipboard) {
                      return;
                    }
                    void navigator.clipboard.writeText(issuedGrant.accessToken);
                  }}
                >
                  <ButtonLeadingVisual>
                    <Copy className="h-3.5 w-3.5" />
                  </ButtonLeadingVisual>
                  <ButtonLabel>Copy token</ButtonLabel>
                </Button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_12rem]">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-grant-participant">
                Participant actor
              </label>
              <Select
                id="terminal-grant-participant"
                value={participantId}
                onChange={(event) => setParticipantId(event.currentTarget.value)}
              >
                <option value="">Select actor</option>
                {actorOptions.map((option) => (
                  <option key={option.actorId} value={option.actorId}>
                    {[option.label, option.actorKind, option.subtitle].filter(Boolean).join(" · ")}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-grant-role">
                Role
              </label>
              <Select id="terminal-grant-role" value={role} onChange={(event) => setRole(event.currentTarget.value as GrantRole)}>
                <option value="readonly">readonly</option>
                <option value="requester">requester</option>
                <option value="writer">writer</option>
                <option value="admin">admin</option>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-grant-label">
                Label
              </label>
              <Input
                id="terminal-grant-label"
                value={label}
                onChange={(event) => setLabel(event.currentTarget.value)}
                placeholder="Pairing operator"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-grant-token">
                Token hint
              </label>
              <Input
                id="terminal-grant-token"
                value={accessTokenHint}
                onChange={(event) => setAccessTokenHint(event.currentTarget.value)}
                placeholder="Reuse an existing 16-128 char token"
              />
            </div>
          </div>

          {role === "admin" ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700" htmlFor="terminal-grant-admin-rank">
                Admin candidate rank
              </label>
              <Input
                id="terminal-grant-admin-rank"
                value={adminCandidateRank}
                onChange={(event) => setAdminCandidateRank(event.currentTarget.value)}
                placeholder="0"
              />
            </div>
          ) : null}

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-medium text-slate-900">Current grants</h3>
              {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
            </div>
            <div className="space-y-2">
              {grants.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No explicit grants yet.
                </div>
              ) : (
                grants.map((grant) => {
                  const actor = terminal?.actors?.find((item) => item.actorId === grant.participantId);
                  const meta = grant.participantId ? actorMeta.get(grant.participantId) : null;
                  const displayLabel = meta?.label ?? grant.label ?? (grant.participantId ? fallbackActorLabel(grant.participantId) : grant.grantId);
                  return (
                    <article key={grant.grantId} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{displayLabel}</span>
                            {meta ? <Badge variant="secondary">{meta.actorKind}</Badge> : null}
                            <Badge variant="secondary">{grant.role}</Badge>
                            {actor?.currentAdmin ? <Badge variant="warning">current admin</Badge> : null}
                            {typeof actor?.adminCandidateRank === "number" ? (
                              <Badge variant="secondary">admin #{actor.adminCandidateRank + 1}</Badge>
                            ) : null}
                            {actor?.invalidCredential ? <Badge variant="destructive">credential invalid</Badge> : null}
                          </div>
                          <p className="break-all text-xs text-slate-500">{grant.participantId ?? grant.grantId}</p>
                          {meta?.subtitle ? <p className="break-all text-xs text-slate-500">{meta.subtitle}</p> : null}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!terminal) {
                              return;
                            }
                            setSaving(true);
                            setError(null);
                            void onRevokeGrant({ terminalId: terminal.terminalId, grantId: grant.grantId })
                              .then(async () => {
                                await load();
                                await onChanged();
                              })
                              .catch((revokeError) => {
                                setError(revokeError instanceof Error ? revokeError.message : String(revokeError));
                              })
                              .finally(() => {
                                setSaving(false);
                              });
                          }}
                          disabled={saving}
                          className={cn(grant.role === "admin" ? "border-amber-200 text-amber-900" : "")}
                        >
                          <ButtonLeadingVisual>
                            <Trash2 className="h-3.5 w-3.5" />
                          </ButtonLeadingVisual>
                          <ButtonLabel>Revoke</ButtonLabel>
                        </Button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </Dialog>

      <Dialog
        open={downgradePromptOpen}
        title="Multiple writers detected"
        description="Terminal writers can conflict with each other. You can downgrade existing writers to requester while keeping their tokens stable."
        onClose={() => {
          if (saving) {
            return;
          }
          setDowngradePromptOpen(false);
        }}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDowngradePromptOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" variant="outline" onClick={() => void applyGrant(false)} disabled={saving}>
              Keep multiple writers
            </Button>
            <Button type="button" onClick={() => void applyGrant(true)} disabled={saving}>
              Downgrade others to requester
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
            The following actors are already `writer`. Shared unrestricted writers can race and overwrite each other's shell state.
          </div>
          <div className="space-y-2">
            {otherWriterGrants.map((grant) => (
              <div key={grant.grantId} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-sm font-medium text-slate-900">
                    {grant.participantId ? actorMeta.get(grant.participantId)?.label ?? fallbackActorLabel(grant.participantId) : grant.grantId}
                  </span>
                  <Badge variant="secondary">writer</Badge>
                  {grant.accessToken ? (
                    <Badge variant="secondary">
                      <KeyRound className="mr-1 h-3 w-3" />
                      keep token
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 break-all text-xs text-slate-500">{grant.participantId ?? grant.grantId}</p>
              </div>
            ))}
          </div>
        </div>
      </Dialog>
    </>
  );
};

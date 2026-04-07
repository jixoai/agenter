import type { AuthActorCatalogEntry, RuntimeClientState } from "@agenter/client-sdk";

export interface ActorDirectoryEntry {
  actorId: string;
  actorKind: "auth" | "session" | "system";
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
}

const SYSTEM_ACTOR_LABELS: Record<string, string> = {
  "system:trusted-bootstrap": "Bootstrap admin",
  "system:trusted-terminal-bootstrap": "Bootstrap admin",
};

export const fallbackActorLabel = (actorId: string): string => {
  const knownSystemLabel = SYSTEM_ACTOR_LABELS[actorId];
  if (knownSystemLabel) {
    return knownSystemLabel;
  }
  return actorId.split(":").at(-1) ?? actorId;
};

export const buildActorDirectory = (input: {
  sessions: RuntimeClientState["sessions"];
  authActors: AuthActorCatalogEntry[];
  profileIconUrl: (reference: string | null | undefined) => string | null;
  sessionIconUrl: (sessionId: string | null | undefined) => string | null;
}): ActorDirectoryEntry[] => {
  const entries: ActorDirectoryEntry[] = [];
  const seen = new Set<string>();

  for (const actor of input.authActors) {
    if (seen.has(actor.actorId)) {
      continue;
    }
    seen.add(actor.actorId);
    entries.push({
      actorId: actor.actorId,
      actorKind: "auth",
      label: actor.label,
      subtitle: actor.subtitle,
      iconUrl: actor.iconUrl && actor.iconUrl.trim().length > 0 ? actor.iconUrl : input.profileIconUrl(actor.profileId),
    });
  }

  for (const session of input.sessions) {
    if (session.storageState !== "active") {
      continue;
    }
    const actorId = `session:${session.id}`;
    const preferredSessionLabel = session.avatar?.trim() || session.name?.trim() || session.id;
    if (seen.has(actorId)) {
      continue;
    }
    seen.add(actorId);
    entries.push({
      actorId,
      actorKind: "session",
      label: preferredSessionLabel,
      subtitle: session.workspacePath,
      iconUrl: input.sessionIconUrl(session.id),
    });
  }

  for (const [actorId, label] of Object.entries(SYSTEM_ACTOR_LABELS)) {
    if (seen.has(actorId)) {
      continue;
    }
    seen.add(actorId);
    entries.push({
      actorId,
      actorKind: "system",
      label,
      subtitle: "System seat",
      iconUrl: null,
    });
  }

  return entries;
};

export const buildActorDirectoryMap = (entries: ActorDirectoryEntry[]): Map<string, ActorDirectoryEntry> =>
  new Map(entries.map((entry) => [entry.actorId, entry]));

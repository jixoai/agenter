import type { AuthActorCatalogEntry, RuntimeClientState } from "@agenter/client-sdk";

import type { IconServiceUrls } from "../profile/icon-service";

export interface ActorDirectoryEntry {
  actorId: string;
  actorKind: "auth" | "session";
  label: string;
  subtitle?: string;
  iconUrl?: string | null;
}

export const fallbackActorLabel = (actorId: string): string => actorId.split(":").at(-1) ?? actorId;

export const buildActorDirectory = (input: {
  sessions: RuntimeClientState["sessions"];
  authActors: AuthActorCatalogEntry[];
  iconUrls: IconServiceUrls;
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
      iconUrl: actor.iconUrl && actor.iconUrl.trim().length > 0 ? actor.iconUrl : input.iconUrls.profile(actor.profileId),
    });
  }

  for (const session of input.sessions) {
    if (session.storageState !== "active") {
      continue;
    }
    const actorId = `session:${session.id}`;
    if (seen.has(actorId)) {
      continue;
    }
    seen.add(actorId);
    entries.push({
      actorId,
      actorKind: "session",
      label: session.name,
      subtitle: session.workspacePath,
      iconUrl: input.iconUrls.session(session.id),
    });
  }

  return entries;
};

export const buildActorDirectoryMap = (entries: ActorDirectoryEntry[]): Map<string, ActorDirectoryEntry> =>
  new Map(entries.map((entry) => [entry.actorId, entry]));

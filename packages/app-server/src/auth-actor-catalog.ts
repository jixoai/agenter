import type { ProfileIdentifier, ProfileProjection } from "@agenter/profile-service";

export interface AuthActorProjection {
  actorId: `auth:${string}`;
  actorKind: "auth";
  authId: string;
  profileId: string;
  label: string;
  subtitle: string;
  iconUrl: string;
  identifier: {
    kind: ProfileIdentifier["kind"];
    value: string;
  };
}

const isDurableIdentifier = (identifier: ProfileIdentifier): boolean => identifier.kind !== "temp";

const normalizeIdentifierValue = (identifier: ProfileIdentifier): string => {
  const value = identifier.value.trim();
  if (identifier.kind === "wallet_solana") {
    return value;
  }
  return value.toLowerCase();
};

const toAuthId = (identifier: ProfileIdentifier): string => `${identifier.kind}:${normalizeIdentifierValue(identifier)}`;

const resolveActorLabel = (profile: ProfileProjection, identifier: ProfileIdentifier): string => {
  const displayName = profile.metadata.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  const nickname = profile.metadata.nickname?.trim();
  if (nickname) {
    return nickname;
  }
  return normalizeIdentifierValue(identifier);
};

export const projectAuthActors = (profiles: ProfileProjection[]): AuthActorProjection[] => {
  const items: AuthActorProjection[] = [];
  for (const profile of profiles) {
    if (!profile.profileId) {
      continue;
    }
    for (const identifier of profile.identifiers) {
      if (!isDurableIdentifier(identifier)) {
        continue;
      }
      const authId = toAuthId(identifier);
      items.push({
        actorId: `auth:${authId}`,
        actorKind: "auth",
        authId,
        profileId: profile.profileId,
        label: resolveActorLabel(profile, identifier),
        subtitle: authId,
        iconUrl: profile.iconUrl,
        identifier: {
          kind: identifier.kind,
          value: normalizeIdentifierValue(identifier),
        },
      });
    }
  }
  return items.sort((left, right) => {
    const labelDiff = left.label.localeCompare(right.label);
    if (labelDiff !== 0) {
      return labelDiff;
    }
    return left.authId.localeCompare(right.authId);
  });
};

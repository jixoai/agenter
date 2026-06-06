import type { GlobalAvatarCatalogEntry, SessionEntry } from "@agenter/client-sdk";

export interface AvatarSessionIdentity {
  avatarPrincipalId: string | null;
  iconUrl: string | null;
}

export interface AvatarSessionIdentityResolverInput {
  resolveAvatarIconUrl: (principalId: string) => string | null;
  resolveAvatarCatalogEntry?: (
    avatarNickname: string,
  ) => Pick<GlobalAvatarCatalogEntry, "avatarPrincipalId" | "displayName" | "iconUrl" | "nickname"> | null;
  resolveAvatarCatalogEntryByPrincipalId?: (
    principalId: string,
  ) => Pick<GlobalAvatarCatalogEntry, "avatarPrincipalId" | "displayName" | "iconUrl" | "nickname"> | null;
}

export const resolveAvatarSessionIdentity = (
  session: Pick<SessionEntry, "avatar" | "avatarPrincipalId">,
  input: AvatarSessionIdentityResolverInput,
): AvatarSessionIdentity => {
  const catalogEntry = input.resolveAvatarCatalogEntry?.(session.avatar) ?? null;
  const avatarPrincipalId = catalogEntry?.avatarPrincipalId ?? session.avatarPrincipalId ?? null;
  const directIconUrl = session.avatarPrincipalId ? input.resolveAvatarIconUrl(session.avatarPrincipalId) : null;
  const catalogIconUrl =
    catalogEntry?.iconUrl ??
    (catalogEntry?.avatarPrincipalId ? input.resolveAvatarIconUrl(catalogEntry.avatarPrincipalId) : null);

  return {
    avatarPrincipalId,
    iconUrl: catalogIconUrl ?? directIconUrl ?? null,
  };
};

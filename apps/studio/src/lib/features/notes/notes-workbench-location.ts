export type NotesMode = "browse" | "search" | "query";

const NOTES_AVATAR_PATH_PATTERN = /^\/notes\/avatar\/([^/]+)(?:\/([^/]+))?\/?$/u;

const normalizeNonEmpty = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
};

export const normalizeNotesMode = (value: string | null | undefined): NotesMode => {
  if (value === "search" || value === "query") {
    return value;
  }
  return "browse";
};

export const buildNotesOverviewHref = (): string => "/notes";

export const buildNotesAvatarHref = (avatarNickname: string, mode: NotesMode = "browse"): string => {
  const normalizedAvatarNickname = normalizeNonEmpty(avatarNickname) ?? "";
  const encodedAvatarNickname = encodeURIComponent(normalizedAvatarNickname);
  const modeSuffix = mode === "browse" ? "" : `/${mode}`;
  return `/notes/avatar/${encodedAvatarNickname}${modeSuffix}`;
};

export const readLegacyNotesAvatarNickname = (searchParams: URLSearchParams): string | null =>
  normalizeNonEmpty(searchParams.get("avatar"));

export interface NotesRouteScope {
  avatarNickname: string | null;
  mode: NotesMode;
}

export const readNotesRouteScope = (pathname: string): NotesRouteScope => {
  const match = NOTES_AVATAR_PATH_PATTERN.exec(pathname);
  if (!match) {
    return {
      avatarNickname: null,
      mode: "browse",
    };
  }
  const avatarNickname = normalizeNonEmpty(decodeURIComponent(match[1] ?? ""));
  return {
    avatarNickname,
    mode: normalizeNotesMode(match[2]),
  };
};

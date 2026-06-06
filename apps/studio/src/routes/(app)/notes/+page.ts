import { redirect } from "@sveltejs/kit";

import { buildNotesAvatarHref, readLegacyNotesAvatarNickname } from "$lib/features/notes/notes-workbench-location";

export const load = ({ url }: { url: URL }) => {
  const legacyAvatarNickname = readLegacyNotesAvatarNickname(url.searchParams);
  if (legacyAvatarNickname) {
    throw redirect(307, buildNotesAvatarHref(legacyAvatarNickname));
  }
};

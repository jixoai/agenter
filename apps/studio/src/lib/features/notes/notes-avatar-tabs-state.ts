import { buildNotesAvatarHref } from "./notes-workbench-location";

const NOTES_AVATAR_TABS_STORAGE_KEY = "agenter:studio:notes:avatar-tabs";
export const NOTES_AVATAR_TABS_CHANGE_EVENT = "agenter:notes-avatar-tabs-change";

export interface NotesAvatarTabEntry {
  id: string;
  avatarNickname: string;
  href: string;
}

const normalizeAvatarNickname = (value: string): string => value.trim();

export const createNotesAvatarTabId = (avatarNickname: string): string =>
  `notes-avatar:${normalizeAvatarNickname(avatarNickname)}`;

export const createNotesAvatarTabEntry = (input: { avatarNickname: string }): NotesAvatarTabEntry => {
  const normalizedAvatarNickname = normalizeAvatarNickname(input.avatarNickname);
  return {
    id: createNotesAvatarTabId(normalizedAvatarNickname),
    avatarNickname: normalizedAvatarNickname,
    href: buildNotesAvatarHref(normalizedAvatarNickname),
  };
};

const normalizeNotesAvatarTabs = (entries: readonly NotesAvatarTabEntry[]): NotesAvatarTabEntry[] => {
  const normalized: NotesAvatarTabEntry[] = [];
  const seenIds = new Set<string>();

  for (const entry of entries) {
    const avatarNickname = normalizeAvatarNickname(entry.avatarNickname);
    if (avatarNickname.length === 0) {
      continue;
    }
    const normalizedEntry = createNotesAvatarTabEntry({
      avatarNickname,
    });
    if (seenIds.has(normalizedEntry.id)) {
      continue;
    }
    seenIds.add(normalizedEntry.id);
    normalized.push(normalizedEntry);
  }

  return normalized;
};

const sameTabIds = (left: readonly NotesAvatarTabEntry[], right: readonly NotesAvatarTabEntry[]): boolean =>
  left.length === right.length && left.every((entry, index) => entry.id === right[index]?.id);

const emitNotesAvatarTabsChange = (): void => {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new CustomEvent(NOTES_AVATAR_TABS_CHANGE_EVENT));
};

export const readNotesAvatarTabs = (): NotesAvatarTabEntry[] => {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(NOTES_AVATAR_TABS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as {
      entries?: Array<{ avatarNickname?: unknown }>;
    };
    if (!Array.isArray(parsed.entries)) {
      return [];
    }
    return normalizeNotesAvatarTabs(
      parsed.entries
        .filter((entry): entry is { avatarNickname: string } => typeof entry?.avatarNickname === "string")
        .map((entry) =>
          createNotesAvatarTabEntry({
            avatarNickname: entry.avatarNickname,
          }),
        ),
    );
  } catch {
    return [];
  }
};

export const writeNotesAvatarTabs = (entries: readonly NotesAvatarTabEntry[]): void => {
  if (typeof window === "undefined") {
    return;
  }
  const normalized = normalizeNotesAvatarTabs(entries);
  if (normalized.length === 0) {
    window.localStorage.removeItem(NOTES_AVATAR_TABS_STORAGE_KEY);
    emitNotesAvatarTabsChange();
    return;
  }
  window.localStorage.setItem(
    NOTES_AVATAR_TABS_STORAGE_KEY,
    JSON.stringify({
      entries: normalized.map((entry) => ({
        avatarNickname: entry.avatarNickname,
      })),
    }),
  );
  emitNotesAvatarTabsChange();
};

export const upsertNotesAvatarTab = (
  currentEntries: NotesAvatarTabEntry[],
  input: {
    avatarNickname: string;
  },
): { entries: NotesAvatarTabEntry[]; entry: NotesAvatarTabEntry } => {
  const normalizedCurrent = normalizeNotesAvatarTabs(currentEntries);
  const entry = createNotesAvatarTabEntry(input);
  const existing = normalizedCurrent.find((currentEntry) => currentEntry.id === entry.id);
  if (existing) {
    if (sameTabIds(currentEntries, normalizedCurrent)) {
      return { entries: currentEntries, entry: existing };
    }
    writeNotesAvatarTabs(normalizedCurrent);
    return { entries: normalizedCurrent, entry: existing };
  }
  const next = [...normalizedCurrent, entry];
  writeNotesAvatarTabs(next);
  return { entries: next, entry };
};

export const removeNotesAvatarTab = (currentEntries: NotesAvatarTabEntry[], tabId: string): NotesAvatarTabEntry[] => {
  const normalizedCurrent = normalizeNotesAvatarTabs(currentEntries);
  const next = normalizedCurrent.filter((entry) => entry.id !== tabId);
  if (sameTabIds(currentEntries, next)) {
    return currentEntries;
  }
  if (sameTabIds(normalizedCurrent, next)) {
    return next;
  }
  writeNotesAvatarTabs(next);
  return next;
};

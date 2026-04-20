import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const MESSAGE_STORAGE_DIRNAME = ".message";
export const MESSAGE_CONTROL_DB_FILENAME = "control.db";
export const MESSAGE_QUERY_DB_FILENAME = "message-query.sqlite";
export const LEGACY_MESSAGE_CONTROL_DB_FILENAMES = ["message.db", "chat.db"] as const;
export const ROOM_MESSAGE_DB_DIRNAME = "rooms";
export const ROOM_MESSAGE_DB_PREFIX = "room-message-";

export const resolveDefaultMessageRoot = (homeDir = homedir()): string =>
  join(homeDir, ".agenter", MESSAGE_STORAGE_DIRNAME);

export const resolveMessageControlDbPath = (messageRoot: string): string =>
  join(messageRoot, MESSAGE_CONTROL_DB_FILENAME);

export const resolveMessageQueryDbPath = (messageRoot: string): string => join(messageRoot, MESSAGE_QUERY_DB_FILENAME);

export const resolveDefaultMessageControlDbPath = (homeDir = homedir()): string =>
  resolveMessageControlDbPath(resolveDefaultMessageRoot(homeDir));

export const pruneLegacyMessageControlDbFiles = (
  messageRoot: string,
  keepFilename = MESSAGE_CONTROL_DB_FILENAME,
): void => {
  for (const filename of LEGACY_MESSAGE_CONTROL_DB_FILENAMES) {
    if (filename === keepFilename) {
      continue;
    }
    const filePath = join(messageRoot, filename);
    rmSync(filePath, { force: true });
    rmSync(`${filePath}-wal`, { force: true });
    rmSync(`${filePath}-shm`, { force: true });
  }
};

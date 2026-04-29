import { Database } from "bun:sqlite";
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface ProfileDatabase {
  connection: Database;
  close: () => Promise<void>;
}

interface AuthorityLockRecord {
  pid: number;
  command: string;
  createdAt: string;
}

interface AuthorityLockHandle {
  readonly owner: AuthorityLockRecord;
  release: () => void;
}

interface ProfileDatabaseDeps {
  openSqlite: (dbPath: string) => Database;
  acquireLock: (input: { dbPath: string; lockPath: string }) => AuthorityLockHandle;
}

const PROFILE_DATABASE_LOCK_FILE = "auth-service.lock.json";

const resolveCurrentProcessCommand = (): string => {
  const args = [process.argv0, ...process.argv.slice(1)].map((part) => part.trim()).filter((part) => part.length > 0);
  return args.join(" ") || process.argv0 || "bun";
};

const openSqliteDatabase = (dbPath: string): Database => {
  mkdirSync(dirname(dbPath), { recursive: true });
  const database = new Database(dbPath, { create: true, strict: true });
  database.exec("pragma journal_mode = wal");
  database.exec("pragma busy_timeout = 5000");
  database.exec("pragma foreign_keys = on");
  return database;
};

const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = error instanceof Error && "code" in error ? String(error.code) : null;
    return code === "EPERM";
  }
};

const normalizeAuthorityLockRecord = (value: unknown): AuthorityLockRecord | null => {
  if (!value || typeof value !== "object") {
    return null;
  }
  const candidate = value as Partial<AuthorityLockRecord>;
  if (typeof candidate.pid !== "number" || !Number.isInteger(candidate.pid) || candidate.pid <= 0) {
    return null;
  }
  return {
    pid: candidate.pid,
    command: typeof candidate.command === "string" && candidate.command.length > 0 ? candidate.command : "unknown",
    createdAt:
      typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
        ? candidate.createdAt
        : new Date(0).toISOString(),
  };
};

const readAuthorityLockRecord = (lockPath: string): AuthorityLockRecord | null => {
  try {
    return normalizeAuthorityLockRecord(JSON.parse(readFileSync(lockPath, "utf8")));
  } catch {
    return null;
  }
};

const sameAuthorityLockOwner = (left: AuthorityLockRecord, right: AuthorityLockRecord): boolean =>
  left.pid === right.pid && left.command === right.command && left.createdAt === right.createdAt;

const buildProfileDatabaseLockError = (
  input: { dbPath: string; owner: AuthorityLockRecord | null },
  lockPath: string,
): Error => {
  const ownerMessage = input.owner ? ` Locked by ${input.owner.command} (PID ${input.owner.pid}).` : "";
  return new Error(
    `[auth-service] single-writer store conflict for ${input.dbPath}.${ownerMessage} Reuse the existing auth-service via --auth-service-endpoint or stop the owning process before starting another instance. Lock file: ${lockPath}`,
  );
};

const acquireProfileDatabaseLock = (input: { dbPath: string; lockPath: string }): AuthorityLockHandle => {
  mkdirSync(dirname(input.lockPath), { recursive: true });
  for (;;) {
    const owner: AuthorityLockRecord = {
      pid: process.pid,
      command: resolveCurrentProcessCommand(),
      createdAt: new Date().toISOString(),
    };
    let fd: number | null = null;
    try {
      fd = openSync(input.lockPath, "wx");
      writeFileSync(fd, `${JSON.stringify(owner, null, 2)}\n`, "utf8");
      closeSync(fd);
      fd = null;
      return {
        owner,
        release: () => {
          const current = readAuthorityLockRecord(input.lockPath);
          if (!current || !sameAuthorityLockOwner(current, owner)) {
            return;
          }
          try {
            unlinkSync(input.lockPath);
          } catch {
            // Best effort only. A stale lock can still be reclaimed on the next startup.
          }
        },
      };
    } catch (error) {
      if (fd !== null) {
        closeSync(fd);
      }
      const code = error instanceof Error && "code" in error ? String(error.code) : null;
      if (code !== "EEXIST") {
        throw error;
      }
      const existing = readAuthorityLockRecord(input.lockPath);
      if (existing && isPidAlive(existing.pid)) {
        throw buildProfileDatabaseLockError({ dbPath: input.dbPath, owner: existing }, input.lockPath);
      }
      try {
        unlinkSync(input.lockPath);
      } catch (unlinkError) {
        const unlinkCode = unlinkError instanceof Error && "code" in unlinkError ? String(unlinkError.code) : null;
        if (unlinkCode !== "ENOENT") {
          throw unlinkError;
        }
      }
    }
  }
};

export const openProfileDatabaseWithDeps = async (
  dbPath: string,
  deps: ProfileDatabaseDeps,
): Promise<ProfileDatabase> => {
  const lock = deps.acquireLock({
    dbPath,
    lockPath: join(dirname(dbPath), PROFILE_DATABASE_LOCK_FILE),
  });
  let connection: Database | null = null;
  try {
    connection = deps.openSqlite(dbPath);
    return {
      connection,
      close: async () => {
        try {
          connection?.close(false);
        } finally {
          lock.release();
        }
      },
    };
  } catch (error) {
    try {
      connection?.close(false);
    } finally {
      lock.release();
    }
    throw error;
  }
};

export const openProfileDatabase = async (dbPath: string): Promise<ProfileDatabase> =>
  await openProfileDatabaseWithDeps(dbPath, {
    openSqlite: openSqliteDatabase,
    acquireLock: acquireProfileDatabaseLock,
  });

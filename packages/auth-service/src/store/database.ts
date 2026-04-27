import { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import { rename } from "node:fs/promises";

export interface ProfileDatabase {
  instance: DuckDBInstance;
  connection: DuckDBConnection;
  close: () => Promise<void>;
}

interface ProfileDatabaseDeps {
  open: (dbPath: string) => Promise<{ instance: DuckDBInstance; connection: DuckDBConnection }>;
  backupWal: (walPath: string) => Promise<string | null>;
  warn: (message: string) => void;
}

const openDuckDb = async (dbPath: string): Promise<{ instance: DuckDBInstance; connection: DuckDBConnection }> => {
  const instance = await DuckDBInstance.create(dbPath);
  const connection = await instance.connect();
  return { instance, connection };
};

export const isRecoverableProfileDatabaseWalError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("Failure while replaying WAL file") && message.includes("already exists");
};

export const backupProfileDatabaseWal = async (walPath: string): Promise<string | null> => {
  const walFile = Bun.file(walPath);
  if (!(await walFile.exists())) {
    return null;
  }
  const backupPath = `${walPath}.recovered-${new Date().toISOString().replaceAll(":", "-")}.bak`;
  await rename(walPath, backupPath);
  return backupPath;
};

export const openProfileDatabaseWithDeps = async (
  dbPath: string,
  deps: ProfileDatabaseDeps,
): Promise<ProfileDatabase> => {
  const walPath = `${dbPath}.wal`;
  let opened: { instance: DuckDBInstance; connection: DuckDBConnection };
  try {
    opened = await deps.open(dbPath);
  } catch (error) {
    if (!isRecoverableProfileDatabaseWalError(error)) {
      throw error;
    }
    const backupPath = await deps.backupWal(walPath);
    if (!backupPath) {
      throw error;
    }
    deps.warn(
      `[auth-service] recovered stale duckdb wal by moving ${walPath} to ${backupPath}; uncheckpointed changes in the wal were preserved in the backup file`,
    );
    opened = await deps.open(dbPath);
  }
  const { instance, connection } = opened;
  return {
    instance,
    connection,
    close: async () => {
      try {
        await connection.run("checkpoint");
      } catch {
        // Best effort only. A failed checkpoint should not block shutdown.
      } finally {
        connection.closeSync();
        instance.closeSync();
      }
    },
  };
};

export const openProfileDatabase = async (dbPath: string): Promise<ProfileDatabase> =>
  await openProfileDatabaseWithDeps(dbPath, {
    open: openDuckDb,
    backupWal: backupProfileDatabaseWal,
    warn: (message) => {
      console.warn(message);
    },
  });

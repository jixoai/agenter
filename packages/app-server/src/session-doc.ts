import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type PersistedSessionStatus = "stopped" | "starting" | "running" | "error";
export type PersistedSessionStorageState = "active" | "archived";

export interface PersistedSession {
  id: string;
  name: string;
  cwd: string;
  avatar: string;
  storeTarget: "global" | "workspace";
  status: PersistedSessionStatus;
  createdAt: string;
  updatedAt: string;
  storageState: PersistedSessionStorageState;
  lastError?: string;
  archivedAt?: string;
  archivedFrom?: string;
}

export interface SessionDocument<TCall = unknown> {
  session: PersistedSession;
  calls: TCall[];
}

export const readSessionDocument = <TCall = unknown>(filePath: string): SessionDocument<TCall> | null => {
  if (!existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as SessionDocument<TCall>;
  } catch {
    return null;
  }
};

export const writeSessionDocument = <TCall>(filePath: string, doc: SessionDocument<TCall>): void => {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
};

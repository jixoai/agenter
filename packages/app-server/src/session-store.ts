import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import { readSessionDocument, writeSessionDocument, type SessionDocument } from "./session-doc";

export interface SessionStoreOptions {
  sessionRoot: string;
  session: {
    id: string;
    name: string;
    cwd: string;
    avatar: string;
    avatarPrincipalId?: string;
    primaryRoomId?: string;
    storeTarget: "global" | "workspace";
  };
}

export class SessionStore {
  private readonly filePath: string;
  private readonly doc: SessionDocument<never>;

  constructor(options: SessionStoreOptions) {
    const now = new Date().toISOString();
    const sessionRoot = resolve(options.sessionRoot);
    mkdirSync(sessionRoot, { recursive: true });
    mkdirSync(join(sessionRoot, "logs"), { recursive: true });
    this.filePath = join(sessionRoot, "session.json");

    const existingSession = readSessionDocument(this.filePath)?.session;
    this.doc = existingSession
      ? {
          session: existingSession,
        }
      : {
      session: {
        id: options.session.id,
        name: options.session.name,
        cwd: options.session.cwd,
        avatar: options.session.avatar,
        avatarPrincipalId: options.session.avatarPrincipalId,
        primaryRoomId: options.session.primaryRoomId,
        storeTarget: options.session.storeTarget,
        status: "stopped",
        createdAt: now,
        updatedAt: now,
        storageState: "active",
      },
    };

    this.doc.session = {
      ...this.doc.session,
      id: options.session.id,
      name: options.session.name,
      cwd: options.session.cwd,
      avatar: options.session.avatar,
      avatarPrincipalId: options.session.avatarPrincipalId,
      primaryRoomId: options.session.primaryRoomId,
      storeTarget: options.session.storeTarget,
      status: "starting",
      updatedAt: now,
      storageState: this.doc.session.storageState ?? "active",
      lastError: undefined,
    };
    this.flush();
  }

  getFilePath(): string {
    return this.filePath;
  }

  setLifecycle(patch: { status: "stopped" | "paused" | "starting" | "running" | "error"; lastError?: string }): void {
    this.doc.session.status = patch.status;
    this.doc.session.lastError = patch.lastError;
    this.doc.session.updatedAt = new Date().toISOString();
    this.flush();
  }

  private flush(): void {
    writeSessionDocument(this.filePath, this.doc);
  }
}

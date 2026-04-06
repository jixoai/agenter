import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

import type { SessionTerminalOutcome, SessionTraceIdentity } from "@agenter/session-system";

import { readSessionDocument, writeSessionDocument, type SessionDocument } from "./session-doc";

export interface SessionCallRecord {
  id: string;
  timestamp: string;
  status: "running" | "done" | "error" | "cancelled";
  completedAt?: string;
  provider: string;
  model: string;
  request: {
    systemPrompt: string;
    messages: unknown[];
    tools: unknown[];
    meta?: Record<string, unknown>;
  };
  response?: {
    decision?: unknown;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
    assistant?: {
      thinking?: string;
      text?: string;
      finishReason?: string | null;
    };
    toolTrace?: Array<{
      invocationId: string;
      tool: string;
      input: unknown;
      output?: unknown;
      error?: string;
      startedAt: number;
      finishedAt: number;
    }>;
  };
  error?: {
    message: string;
    name?: string;
    stack?: string;
    details?: unknown;
  };
  trace?: SessionTraceIdentity;
  outcome?: SessionTerminalOutcome;
}

export interface SessionStoreOptions {
  sessionRoot: string;
  session: {
    id: string;
    name: string;
    cwd: string;
    avatar: string;
    avatarPrincipalId?: string;
    storeTarget: "global" | "workspace";
  };
}

export class SessionStore {
  private readonly filePath: string;
  private readonly doc: SessionDocument<SessionCallRecord>;

  constructor(options: SessionStoreOptions) {
    const now = new Date().toISOString();
    const sessionRoot = resolve(options.sessionRoot);
    mkdirSync(sessionRoot, { recursive: true });
    mkdirSync(join(sessionRoot, "logs"), { recursive: true });
    this.filePath = join(sessionRoot, "session.json");

    const existing = readSessionDocument<SessionCallRecord>(this.filePath);
    this.doc = existing ?? {
      session: {
        id: options.session.id,
        name: options.session.name,
        cwd: options.session.cwd,
        avatar: options.session.avatar,
        avatarPrincipalId: options.session.avatarPrincipalId,
        storeTarget: options.session.storeTarget,
        status: "stopped",
        createdAt: now,
        updatedAt: now,
        storageState: "active",
      },
      calls: [],
    };

    this.doc.session = {
      ...this.doc.session,
      id: options.session.id,
      name: options.session.name,
      cwd: options.session.cwd,
      avatar: options.session.avatar,
      avatarPrincipalId: options.session.avatarPrincipalId,
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

  appendCall(call: SessionCallRecord): void {
    const index = this.doc.calls.findIndex((entry) => entry.id === call.id);
    if (index >= 0) {
      this.doc.calls[index] = call;
    } else {
      this.doc.calls.push(call);
    }
    this.doc.session.updatedAt = new Date().toISOString();
    this.flush();
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

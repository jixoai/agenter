import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

interface SessionJson {
  session: {
    id: string;
    name: string;
    cwd: string;
    avatar: string;
    storeTarget: "global" | "workspace";
    status: "stopped" | "starting" | "running" | "error";
    createdAt: string;
    updatedAt: string;
    lastError?: string;
  };
  calls: SessionCallRecord[];
}

export interface SessionCallRecord {
  id: string;
  timestamp: string;
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
      tool: string;
      input: unknown;
      output?: unknown;
      error?: string;
      timestamp: string;
    }>;
  };
  error?: {
    message: string;
    name?: string;
    stack?: string;
    details?: unknown;
  };
}

export interface SessionStoreOptions {
  sessionRoot: string;
  session: {
    id: string;
    name: string;
    cwd: string;
    avatar: string;
    storeTarget: "global" | "workspace";
  };
}

export class SessionStore {
  private readonly filePath: string;
  private readonly doc: SessionJson;

  constructor(options: SessionStoreOptions) {
    const now = new Date().toISOString();
    const sessionRoot = resolve(options.sessionRoot);
    mkdirSync(sessionRoot, { recursive: true });
    mkdirSync(join(sessionRoot, "logs"), { recursive: true });
    this.filePath = join(sessionRoot, "session.json");
    this.doc = {
      session: {
        id: options.session.id,
        name: options.session.name,
        cwd: options.session.cwd,
        avatar: options.session.avatar,
        storeTarget: options.session.storeTarget,
        status: "starting",
        createdAt: now,
        updatedAt: now,
      },
      calls: [],
    };
    this.flush();
  }

  getFilePath(): string {
    return this.filePath;
  }

  appendCall(call: SessionCallRecord): void {
    this.doc.calls.push(call);
    this.doc.session.updatedAt = new Date().toISOString();
    this.flush();
  }

  setLifecycle(patch: { status: "stopped" | "starting" | "running" | "error"; lastError?: string }): void {
    this.doc.session.status = patch.status;
    this.doc.session.lastError = patch.lastError;
    this.doc.session.updatedAt = new Date().toISOString();
    this.flush();
  }

  private flush(): void {
    writeFileSync(this.filePath, `${JSON.stringify(this.doc, null, 2)}\n`, "utf8");
  }
}

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface SessionJson {
  createdAt: string;
  updatedAt: string;
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

export class SessionStore {
  private readonly filePath: string;
  private readonly doc: SessionJson;

  constructor(logRoot: string) {
    const stamp = new Date().toISOString().replaceAll(":", "-");
    const dir = join(logRoot, "sessions", `session-${stamp}`);
    mkdirSync(dir, { recursive: true });
    this.filePath = join(dir, "session.json");
    this.doc = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      calls: [],
    };
    this.flush();
  }

  getFilePath(): string {
    return this.filePath;
  }

  appendCall(call: SessionCallRecord): void {
    this.doc.calls.push(call);
    this.doc.updatedAt = new Date().toISOString();
    this.flush();
  }

  private flush(): void {
    writeFileSync(this.filePath, `${JSON.stringify(this.doc, null, 2)}\n`, "utf8");
  }
}

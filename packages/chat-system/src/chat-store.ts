import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ChatSystemSnapshot } from "./chat-types";

const DEFAULT_SNAPSHOT: ChatSystemSnapshot = {
  nextId: 1,
  records: [],
};

export class ChatStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly rootDir: string) {}

  getStatePath(): string {
    return join(this.rootDir, "state.json");
  }

  async load(): Promise<ChatSystemSnapshot> {
    const statePath = this.getStatePath();
    try {
      const text = await readFile(statePath, "utf8");
      const parsed = JSON.parse(text) as ChatSystemSnapshot;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.records)) {
        return { ...DEFAULT_SNAPSHOT };
      }
      return {
        nextId: Math.max(1, Math.trunc(parsed.nextId) || 1),
        records: parsed.records.map((record) => ({ ...record })),
      };
    } catch {
      return { ...DEFAULT_SNAPSHOT };
    }
  }

  async save(snapshot: ChatSystemSnapshot): Promise<void> {
    const payload = JSON.stringify(snapshot, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(this.rootDir, { recursive: true });
      const statePath = this.getStatePath();
      const tempPath = `${statePath}.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
      try {
        await writeFile(tempPath, payload, "utf8");
        await rename(tempPath, statePath);
      } catch (error) {
        if (error instanceof Error && "code" in error && (error as { code?: string }).code === "ENOENT") {
          await mkdir(this.rootDir, { recursive: true });
          await writeFile(tempPath, payload, "utf8");
          await rename(tempPath, statePath);
          return;
        }
        throw error;
      }
    });
    await this.writeQueue;
  }
}

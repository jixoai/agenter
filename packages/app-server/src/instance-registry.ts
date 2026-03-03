import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";

import { z } from "zod";

const isoNow = (): string => new Date().toISOString();

const instanceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  cwd: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  autoStart: z.boolean(),
  status: z.enum(["stopped", "starting", "running", "error"]),
  lastError: z.string().optional(),
});

const registrySchema = z.object({
  updatedAt: z.string().min(1),
  instances: z.array(instanceSchema),
});

export type InstanceStatus = z.infer<typeof instanceSchema>["status"];

export interface InstanceMeta extends z.infer<typeof instanceSchema> {}

export interface InstanceRegistryOptions {
  filePath?: string;
}

const defaultPath = (): string => resolve(homedir(), ".agenter", "instances.json");

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export class InstanceRegistry {
  private readonly filePath: string;
  private readonly byId = new Map<string, InstanceMeta>();

  constructor(options: InstanceRegistryOptions = {}) {
    this.filePath = options.filePath ?? defaultPath();
    this.load();
  }

  getFilePath(): string {
    return this.filePath;
  }

  list(): InstanceMeta[] {
    return [...this.byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  get(instanceId: string): InstanceMeta | undefined {
    return this.byId.get(instanceId);
  }

  create(input: { name?: string; cwd: string; autoStart?: boolean }): InstanceMeta {
    const id = createId();
    const now = isoNow();
    const name = input.name?.trim().length ? input.name.trim() : this.deriveName(input.cwd);
    const instance: InstanceMeta = {
      id,
      name,
      cwd: resolve(input.cwd),
      createdAt: now,
      updatedAt: now,
      autoStart: input.autoStart ?? true,
      status: "stopped",
    };
    this.byId.set(id, instance);
    this.persist();
    return instance;
  }

  update(instanceId: string, patch: { name?: string; autoStart?: boolean; status?: InstanceStatus; lastError?: string }): InstanceMeta {
    const current = this.byId.get(instanceId);
    if (!current) {
      throw new Error(`instance not found: ${instanceId}`);
    }
    const next: InstanceMeta = {
      ...current,
      name: patch.name?.trim().length ? patch.name.trim() : current.name,
      autoStart: patch.autoStart ?? current.autoStart,
      status: patch.status ?? current.status,
      lastError: patch.lastError,
      updatedAt: isoNow(),
    };
    this.byId.set(instanceId, next);
    this.persist();
    return next;
  }

  remove(instanceId: string): boolean {
    const removed = this.byId.delete(instanceId);
    if (removed) {
      this.persist();
    }
    return removed;
  }

  private load(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    try {
      const text = readFileSync(this.filePath, "utf8");
      const parsed = registrySchema.parse(JSON.parse(text));
      for (const instance of parsed.instances) {
        this.byId.set(instance.id, instance);
      }
    } catch {
      this.persist();
    }
  }

  private persist(): void {
    const doc = {
      updatedAt: isoNow(),
      instances: this.list(),
    };
    writeFileSync(this.filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  private deriveName(cwd: string): string {
    const normalized = resolve(cwd);
    const part = normalized.split("/").filter((token) => token.length > 0).at(-1) ?? "workspace";
    return part;
  }
}

import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

import { McpSystemStore } from "./store";
import type {
  McpAddInput,
  McpCallInput,
  McpCallResult,
  McpCapabilitySnapshot,
  McpDisableInput,
  McpGlobalConfig,
  McpInstanceRecord,
  McpListInput,
  McpProjectEnablement,
  McpProjectInput,
  McpQueryInput,
  McpQueryResult,
  McpRemoveInput,
  McpTransportConfig,
  McpTransportStartContext,
} from "./types";

export interface McpSystemOptions {
  dbPath: string;
  rootWorkspacePath: string;
  runtimeEnv?: Record<string, string>;
  runtimeEnvProvider?: () => Record<string, string>;
  clientName?: string;
  clientVersion?: string;
  transportFactory?: (context: McpTransportStartContext) => Transport;
}

interface McpLiveSession {
  client: Client;
  transport: Transport;
  instance: McpInstanceRecord;
  snapshot: McpCapabilitySnapshot;
}

const actionError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const instanceKey = (name: string, projectPath: string): string => `${name}\u0000${resolve(projectPath)}`;

const normalizeProjectPath = (projectPath: string): string => {
  const normalized = resolve(projectPath.trim());
  if (!normalized) {
    throw new Error("projectPath is required");
  }
  return normalized;
};

const cloneStringRecord = (input: Record<string, string> | undefined): Record<string, string> => ({ ...(input ?? {}) });

const createHeadersInit = (headers: Record<string, string> | undefined): HeadersInit | undefined =>
  headers ? cloneStringRecord(headers) : undefined;

export const createMcpSystemTransport = (context: McpTransportStartContext): Transport => {
  const { transport } = context;
  if (transport.kind === "stdio") {
    return new StdioClientTransport({
      command: transport.command,
      args: transport.args ?? [],
      env: {
        ...context.env,
        ...(transport.env ?? {}),
      },
      cwd: context.projectPath,
      stderr: "pipe",
    });
  }
  if (transport.kind === "streamable-http") {
    return new StreamableHTTPClientTransport(new URL(transport.url), {
      requestInit: {
        headers: createHeadersInit(transport.headers),
      },
    });
  }
  return new SSEClientTransport(new URL(transport.url), {
    eventSourceInit: {
      fetch: (url, init) =>
        fetch(url, {
          ...init,
          headers: {
            ...cloneStringRecord(transport.headers),
            ...(init?.headers ? Object.fromEntries(new Headers(init.headers).entries()) : {}),
          },
        }),
    },
    requestInit: {
      headers: createHeadersInit(transport.headers),
    },
  });
};

const safeList = async <T>(operation: () => Promise<{ [key: string]: unknown }>, key: string): Promise<T[]> => {
  try {
    const result = await operation();
    const value = result[key];
    return Array.isArray(value) ? (value as T[]) : [];
  } catch {
    return [];
  }
};

export class McpSystem {
  readonly store: McpSystemStore;

  private readonly rootWorkspacePath: string;
  private readonly runtimeEnv: Record<string, string>;
  private readonly runtimeEnvProvider?: () => Record<string, string>;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private readonly transportFactory: (context: McpTransportStartContext) => Transport;
  private readonly sessions = new Map<string, McpLiveSession>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private closed = false;

  constructor(options: McpSystemOptions) {
    this.rootWorkspacePath = resolve(options.rootWorkspacePath);
    mkdirSync(this.rootWorkspacePath, { recursive: true });
    this.runtimeEnv = cloneStringRecord(options.runtimeEnv);
    this.runtimeEnvProvider = options.runtimeEnvProvider;
    this.clientName = options.clientName ?? "agenter-mcp-system";
    this.clientVersion = options.clientVersion ?? "0.0.0";
    this.transportFactory = options.transportFactory ?? createMcpSystemTransport;
    this.store = new McpSystemStore(options.dbPath);
    this.store.recoverLiveInstancesAsStopped();
  }

  close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    const stoppedAt = new Date().toISOString();
    for (const session of this.sessions.values()) {
      this.store.updateInstance({
        name: session.instance.name,
        projectPath: session.instance.projectPath,
        lifecycle: "stopped",
        lastError: null,
        lastStoppedAt: stoppedAt,
        updatedAt: stoppedAt,
      });
      void session.client.close().catch(() => undefined);
    }
    this.sessions.clear();
    this.store.close();
  }

  add(input: McpAddInput): McpGlobalConfig {
    return this.store.addGlobal(input);
  }

  async remove(input: McpRemoveInput): Promise<{ removed: boolean; blockedProjects: string[] }> {
    if (input.stop === true) {
      await Promise.all(
        [...this.sessions.keys()]
          .filter((key) => key.startsWith(`${input.name}\u0000`))
          .map(async (key) => {
            const session = this.sessions.get(key);
            if (session) {
              await this.stop({ name: session.instance.name, projectPath: session.instance.projectPath });
            }
          }),
      );
    }
    return this.store.removeGlobal(input);
  }

  enable(input: McpProjectInput): McpProjectEnablement {
    return this.store.enableProject(input);
  }

  async disable(input: McpDisableInput): Promise<McpProjectEnablement> {
    if (input.stop !== false) {
      await this.stopIfRunning(input.name, input.projectPath);
    }
    return this.store.disableProject(input);
  }

  list(input: McpListInput) {
    return this.store.listProject(input);
  }

  query(input: McpQueryInput): McpQueryResult {
    return this.store.query(input);
  }

  async start(input: McpProjectInput): Promise<{ instance: McpInstanceRecord; snapshot: McpCapabilitySnapshot }> {
    return await this.withInstanceLock(input.name, input.projectPath, async () => {
      const name = input.name;
      const projectPath = normalizeProjectPath(input.projectPath);
      const existing = this.sessions.get(instanceKey(name, projectPath));
      if (existing) {
        return { instance: existing.instance, snapshot: existing.snapshot };
      }

      const global = this.store.requireGlobal(name);
      this.store.requireEnabledProject(name, projectPath);
      this.store.updateInstance({
        name,
        projectPath,
        lifecycle: "starting",
        lastError: null,
      });

      const client = new Client({
        name: this.clientName,
        version: this.clientVersion,
      });
      const transport = this.transportFactory({
        name,
        projectPath,
        transport: global.transport,
        env: this.resolveEnv(global),
      });

      try {
        await client.connect(transport);
        const snapshot = await this.discover({ client, name, projectPath, transport: global.transport });
        const instance = this.store.updateInstance({
          name,
          projectPath,
          lifecycle: "running",
          lastError: null,
          lastStartedAt: snapshot.snapshotAt,
          updatedAt: snapshot.snapshotAt,
        });
        this.store.saveSnapshot(snapshot);
        this.sessions.set(instanceKey(name, projectPath), { client, transport, instance, snapshot });
        this.store.recordAction({
          action: "start",
          name,
          projectPath,
          status: "success",
        });
        return { instance, snapshot };
      } catch (error) {
        const message = actionError(error);
        await client.close().catch(() => undefined);
        this.store.updateInstance({
          name,
          projectPath,
          lifecycle: "failed",
          lastError: message,
        });
        this.store.recordAction({
          action: "start",
          name,
          projectPath,
          status: "error",
          error: message,
        });
        throw error;
      }
    });
  }

  async stop(input: McpProjectInput): Promise<{ instance: McpInstanceRecord }> {
    return await this.withInstanceLock(input.name, input.projectPath, async () => {
      const name = input.name;
      const projectPath = normalizeProjectPath(input.projectPath);
      const key = instanceKey(name, projectPath);
      const session = this.sessions.get(key);
      this.sessions.delete(key);
      const stoppedAt = new Date().toISOString();
      try {
        await session?.client.close();
        const instance = this.store.updateInstance({
          name,
          projectPath,
          lifecycle: "stopped",
          lastError: null,
          lastStoppedAt: stoppedAt,
          updatedAt: stoppedAt,
        });
        this.store.recordAction({
          action: "stop",
          name,
          projectPath,
          status: "success",
        });
        return { instance };
      } catch (error) {
        const message = actionError(error);
        const instance = this.store.updateInstance({
          name,
          projectPath,
          lifecycle: "failed",
          lastError: message,
        });
        this.store.recordAction({
          action: "stop",
          name,
          projectPath,
          status: "error",
          error: message,
        });
        return { instance };
      }
    });
  }

  async restart(input: McpProjectInput): Promise<{ instance: McpInstanceRecord; snapshot: McpCapabilitySnapshot }> {
    await this.stop(input);
    return await this.start(input);
  }

  async call(input: McpCallInput, options: { signal?: AbortSignal } = {}): Promise<McpCallResult> {
    const name = input.name;
    const projectPath = normalizeProjectPath(input.projectPath);
    const autoStart = input.autoStart ?? true;
    const autoEnable = input.autoEnable ?? false;
    try {
      const global = this.store.requireGlobal(name);
      const enablement = this.store.getExplicitEnablement(name, projectPath);
      if (!enablement?.enabled) {
        if (!autoEnable) {
          throw new Error(`mcp global ${name} is not enabled for project ${projectPath}`);
        }
        this.store.enableProject({ name, projectPath });
      }

      const key = instanceKey(name, projectPath);
      let session = this.sessions.get(key);
      if (!session) {
        if (!autoStart) {
          throw new Error(`mcp global ${name} is not running for project ${projectPath}`);
        }
        await this.start({ name, projectPath });
        session = this.sessions.get(key);
      }
      if (!session) {
        throw new Error(`mcp global ${name} failed to start for project ${projectPath}`);
      }

      const result = await session.client.callTool(
        {
          name: input.toolName,
          arguments: input.arguments ?? {},
        },
        undefined,
        {
          signal: options.signal,
        },
      );
      this.store.markUsed(name, projectPath);
      this.store.recordAction({
        action: "call",
        name,
        projectPath,
        toolName: input.toolName,
        autoStart,
        autoEnable,
        status: "success",
        inputSummary: JSON.stringify(input.arguments ?? {}),
      });
      return { result, instance: session.instance };
    } catch (error) {
      this.store.recordAction({
        action: "call",
        name,
        projectPath,
        toolName: input.toolName,
        autoStart,
        autoEnable,
        status: "error",
        inputSummary: JSON.stringify(input.arguments ?? {}),
        error: actionError(error),
      });
      throw error;
    }
  }

  private async stopIfRunning(name: string, projectPath: string): Promise<void> {
    if (this.sessions.has(instanceKey(name, projectPath))) {
      await this.stop({ name, projectPath });
      return;
    }
    const instance = this.store.getInstance(name, projectPath);
    if (instance?.lifecycle === "running" || instance?.lifecycle === "starting") {
      this.store.updateInstance({
        name,
        projectPath,
        lifecycle: "stopped",
        lastStoppedAt: new Date().toISOString(),
      });
    }
  }

  private resolveEnv(global: McpGlobalConfig): Record<string, string> {
    return {
      ...process.env,
      HOME: this.rootWorkspacePath,
      ...this.runtimeEnv,
      ...(this.runtimeEnvProvider?.() ?? {}),
      ...(global.env ?? {}),
    };
  }

  private async discover(input: {
    client: Client;
    name: string;
    projectPath: string;
    transport: McpTransportConfig;
  }): Promise<McpCapabilitySnapshot> {
    const capabilities = input.client.getServerCapabilities();
    const tools = capabilities?.tools
      ? await safeList<unknown>(() => input.client.listTools(undefined, { timeout: 30_000 }), "tools")
      : [];
    const resources = capabilities?.resources
      ? await safeList<unknown>(() => input.client.listResources(undefined, { timeout: 30_000 }), "resources")
      : [];
    const prompts = capabilities?.prompts
      ? await safeList<unknown>(() => input.client.listPrompts(undefined, { timeout: 30_000 }), "prompts")
      : [];
    const server = input.client.getServerVersion();
    const snapshotAt = new Date().toISOString();
    return {
      name: input.name,
      projectPath: input.projectPath,
    serverName: server?.name,
    serverVersion: server?.version,
      tools,
      resources,
      prompts,
      snapshot: {
        server,
        capabilities,
        transportKind: input.transport.kind,
        instructions: input.client.getInstructions(),
      },
      snapshotAt,
    };
  }

  private async withInstanceLock<T>(name: string, projectPath: string, operation: () => Promise<T>): Promise<T> {
    const key = instanceKey(name, projectPath);
    const previous = this.locks.get(key);
    if (previous) {
      await previous.catch(() => undefined);
    }
    const current = operation();
    this.locks.set(key, current);
    try {
      return await current;
    } finally {
      if (this.locks.get(key) === current) {
        this.locks.delete(key);
      }
    }
  }
}

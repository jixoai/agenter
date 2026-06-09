import { randomUUID } from "node:crypto";
import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from "node:child_process";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";

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
  McpInspectorCloseInput,
  McpInspectorEvent,
  McpInspectorLogEntry,
  McpInspectorSessionSnapshot,
  McpInspectorStartInput,
  McpInspectorState,
  McpInspectInput,
  McpInspectResult,
  McpInstanceRecord,
  McpJsonObject,
  McpListInput,
  McpProbeCliResult,
  McpProbeInput,
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
  baseEnv?: Record<string, string>;
  envProvider?: () => Record<string, string>;
  clientName?: string;
  clientVersion?: string;
  transportFactory?: (context: McpTransportStartContext) => Transport;
  inspectorSpawnFactory?: McpInspectorSpawnFactory;
}

export type McpInspectorSpawnFactory = (
  command: string,
  args: string[],
  options: SpawnOptionsWithoutStdio,
) => ChildProcessWithoutNullStreams;

interface McpLiveSession {
  client: Client;
  transport: Transport;
  instance: McpInstanceRecord;
  snapshot: McpCapabilitySnapshot;
}

interface McpProbeSession {
  client: Client;
  transport: Transport;
  name: string;
  projectPath: string;
  snapshot: McpCapabilitySnapshot;
  createdAt: string;
  updatedAt: string;
}

interface McpInspectorSession {
  sessionId: string;
  leaseId: string;
  state: McpInspectorState;
  child: ChildProcessWithoutNullStreams;
  configPath: string;
  url?: string;
  command: "bunx";
  args: string[];
  cwd: string;
  logs: McpInspectorLogEntry[];
  exitCode?: number | null;
  signal?: string | null;
  error?: string;
  startedAt: string;
  updatedAt: string;
  closedAt?: string;
  nextLogId: number;
  closeRequested: boolean;
  leaseAttached: boolean;
  leaseClaimTimer: ReturnType<typeof setTimeout> | null;
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

const createPromptArguments = (argumentsInput: McpJsonObject | undefined): Record<string, string> | undefined => {
  if (!argumentsInput) {
    return undefined;
  }
  const entries = Object.entries(argumentsInput);
  if (entries.length === 0) {
    return undefined;
  }
  const promptArguments: Record<string, string> = {};
  for (const [key, value] of entries) {
    if (typeof value !== "string") {
      throw new Error("prompt arguments must contain only string values");
    }
    promptArguments[key] = value;
  }
  return promptArguments;
};

const INSPECTOR_LOG_LIMIT = 500;
const INSPECTOR_LEASE_CLAIM_TIMEOUT_MS = 30_000;

const stripAnsi = (input: string): string => input.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "");

const inspectorUrlPattern = /\bhttps?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?\/[^\s'"<>)]*/giu;

const reserveTcpPort = async (): Promise<number> =>
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(port);
      });
    });
  });

type McpInspectorServerConfig =
  | {
      type: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  | {
      type: "sse" | "streamable-http";
      url: string;
      headers?: Record<string, string>;
    };

const buildInspectorServerConfig = (transport: McpTransportConfig): McpInspectorServerConfig => {
  if (transport.kind === "stdio") {
    return {
      type: "stdio",
      command: transport.command,
      args: transport.args ?? [],
      env: transport.env,
    };
  }
  return {
    type: transport.kind,
    url: transport.url,
    headers: transport.headers,
  };
};

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readString = (value: unknown, key: string): string | null => {
  if (!isRecord(value)) {
    return null;
  }
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
};

const resolveMcpAppResourceUri = (tool: unknown): string | null => {
  if (!isRecord(tool) || !isRecord(tool._meta)) {
    return null;
  }
  const nestedUi = isRecord(tool._meta.ui) ? readString(tool._meta.ui, "resourceUri") : null;
  return nestedUi ?? readString(tool._meta, "ui/resourceUri") ?? readString(tool._meta, "openai/outputTemplate");
};

const extractMcpApps = (input: {
  tools: unknown[];
  resources: unknown[];
  resourceTemplates: unknown[];
}): unknown[] => {
  const resourcesByUri = new Map(
    input.resources.flatMap((resource) => {
      const uri = readString(resource, "uri");
      return uri ? [[uri, resource] as const] : [];
    }),
  );
  const templatesByUri = new Map(
    input.resourceTemplates.flatMap((template) => {
      const uriTemplate = readString(template, "uriTemplate");
      return uriTemplate ? [[uriTemplate, template] as const] : [];
    }),
  );
  return input.tools.flatMap((tool) => {
    const resourceUri = resolveMcpAppResourceUri(tool);
    const toolName = readString(tool, "name");
    if (!resourceUri || !toolName) {
      return [];
    }
    return [
      {
        type: "app",
        toolName,
        resourceUri,
        tool,
        resource: resourcesByUri.get(resourceUri) ?? templatesByUri.get(resourceUri) ?? null,
      },
    ];
  });
};

export class McpSystem {
  readonly store: McpSystemStore;

  private readonly rootWorkspacePath: string;
  private readonly baseEnv: Record<string, string>;
  private readonly envProvider?: () => Record<string, string>;
  private readonly clientName: string;
  private readonly clientVersion: string;
  private readonly transportFactory: (context: McpTransportStartContext) => Transport;
  private readonly inspectorSpawnFactory: McpInspectorSpawnFactory;
  private readonly sessions = new Map<string, McpLiveSession>();
  private readonly probeSessions = new Map<string, McpProbeSession>();
  private readonly inspectorSessions = new Map<string, McpInspectorSession>();
  private readonly inspectorSessionIdsByLease = new Map<string, string>();
  private readonly inspectorListeners = new Map<string, Set<(event: McpInspectorEvent) => void>>();
  private readonly locks = new Map<string, Promise<unknown>>();
  private closed = false;

  constructor(options: McpSystemOptions) {
    this.rootWorkspacePath = resolve(options.rootWorkspacePath);
    mkdirSync(this.rootWorkspacePath, { recursive: true });
    this.baseEnv = cloneStringRecord(options.baseEnv);
    this.envProvider = options.envProvider;
    this.clientName = options.clientName ?? "agenter-mcp-system";
    this.clientVersion = options.clientVersion ?? "0.0.0";
    this.transportFactory = options.transportFactory ?? createMcpSystemTransport;
    this.inspectorSpawnFactory = options.inspectorSpawnFactory ?? spawn;
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
    for (const session of this.probeSessions.values()) {
      void session.client.close().catch(() => undefined);
    }
    this.probeSessions.clear();
    for (const session of this.inspectorSessions.values()) {
      this.clearInspectorLeaseTimer(session);
      this.killInspectorProcess(session);
      this.unlinkInspectorConfig(session);
    }
    this.inspectorSessions.clear();
    this.inspectorSessionIdsByLease.clear();
    this.inspectorListeners.clear();
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

  async inspect(input: McpInspectInput, options: { signal?: AbortSignal } = {}): Promise<McpInspectResult> {
    const name = input.name?.trim() || "inspect";
    const projectPath = input.projectPath ? normalizeProjectPath(input.projectPath) : this.rootWorkspacePath;
    const connection = await this.connectEphemeral({
      name,
      projectPath,
      transport: input.transport,
      env: input.env,
    });
    try {
      if (!input.capabilityKind && !input.toolName && !input.resourceUri && !input.promptName) {
        return { snapshot: connection.snapshot };
      }

      let result: unknown;
      const capabilityKind = input.capabilityKind ?? (input.toolName ? "tool" : input.resourceUri ? "resource" : "prompt");
      if (capabilityKind === "tool") {
        if (!input.toolName?.trim()) {
          throw new Error("toolName is required for tool inspect calls");
        }
        result = await connection.client.callTool(
          {
            name: input.toolName,
            arguments: input.arguments ?? {},
          },
          undefined,
          {
            signal: options.signal,
          },
        );
      } else if (capabilityKind === "resource") {
        if (!input.resourceUri?.trim()) {
          throw new Error("resourceUri is required for resource inspect reads");
        }
        result = await connection.client.readResource(
          {
            uri: input.resourceUri,
          },
          {
            signal: options.signal,
          },
        );
      } else {
        if (!input.promptName?.trim()) {
          throw new Error("promptName is required for prompt inspect gets");
        }
        result = await connection.client.getPrompt(
          {
            name: input.promptName,
            arguments: createPromptArguments(input.arguments),
          },
          {
            signal: options.signal,
          },
        );
      }

      return {
        snapshot: connection.snapshot,
        result,
      };
    } finally {
      await connection.client.close().catch(() => undefined);
    }
  }

  async probe(input: McpProbeInput, options: { signal?: AbortSignal } = {}): Promise<McpProbeCliResult> {
    try {
      let parsed: unknown;
      if (input.action === "open") {
        const name = input.name?.trim() || "probe";
        const projectPath = input.projectPath ? normalizeProjectPath(input.projectPath) : this.rootWorkspacePath;
        const connection = await this.connectEphemeral({
          name,
          projectPath,
          transport: input.transport,
          env: input.env,
        });
        const probeId = randomUUID();
        const now = new Date().toISOString();
        this.probeSessions.set(probeId, {
          client: connection.client,
          transport: connection.transport,
          name,
          projectPath,
          snapshot: connection.snapshot,
          createdAt: now,
          updatedAt: now,
        });
        parsed = {
          probeId,
          snapshot: connection.snapshot,
        };
      } else if (input.action === "close") {
        const session = this.requireProbeSession(input.probeId);
        this.probeSessions.delete(input.probeId);
        await session.client.close().catch(() => undefined);
        parsed = { probeId: input.probeId, closed: true };
      } else {
        const session = this.requireProbeSession(input.probeId);
        session.updatedAt = new Date().toISOString();
        if (input.action === "ping") {
          parsed = await session.client.ping({ signal: options.signal });
        } else if (input.action === "call-tool") {
          parsed = await session.client.callTool(
            {
              name: input.toolName,
              arguments: input.arguments ?? {},
            },
            undefined,
            {
              signal: options.signal,
            },
          );
        } else if (input.action === "read-resource") {
          parsed = await session.client.readResource(
            {
              uri: input.resourceUri,
            },
            {
              signal: options.signal,
            },
          );
        } else if (input.action === "get-prompt") {
          parsed = await session.client.getPrompt(
            {
              name: input.promptName,
              arguments: createPromptArguments(input.arguments),
            },
            {
              signal: options.signal,
            },
          );
        } else {
          parsed = await session.client.complete(
            {
              ref: input.ref,
              argument: input.argument,
              context: input.context,
            },
            {
              signal: options.signal,
            },
          );
        }
      }
      return this.formatProbeResult(input, { parsed, exitCode: 0 });
    } catch (error) {
      return this.formatProbeResult(input, { stderr: `${actionError(error)}\n`, exitCode: 1 });
    }
  }

  async inspectorStart(input: McpInspectorStartInput): Promise<McpInspectorSessionSnapshot> {
    const name = input.name?.trim() || "inspector";
    const projectPath = input.projectPath ? normalizeProjectPath(input.projectPath) : this.rootWorkspacePath;
    const sessionId = randomUUID();
    const leaseId = randomUUID();
    const inspectorServerName = name.replace(/[^a-zA-Z0-9_.-]/gu, "-") || "mcp";
    const clientPort = await reserveTcpPort();
    const serverPort = await reserveTcpPort();
    const configPath = join(this.rootWorkspacePath, "tmp", `mcp-inspector-${sessionId}.json`);
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          mcpServers: {
            [inspectorServerName]: buildInspectorServerConfig(input.transport),
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const args = ["@modelcontextprotocol/inspector", "--config", configPath, "--server", inspectorServerName];
    const launchEnv = this.resolveLaunchEnv(input.env);
    const child = this.inspectorSpawnFactory("bunx", args, {
      cwd: projectPath,
      env: {
        ...launchEnv,
        CLIENT_PORT: String(clientPort),
        SERVER_PORT: String(serverPort),
        HOST: "127.0.0.1",
        MCP_AUTO_OPEN_ENABLED: "false",
      },
      detached: process.platform !== "win32",
    });
    const now = new Date().toISOString();
    const session: McpInspectorSession = {
      sessionId,
      leaseId,
      state: "starting",
      child,
      configPath,
      command: "bunx",
      args,
      cwd: projectPath,
      logs: [],
      startedAt: now,
      updatedAt: now,
      nextLogId: 1,
      closeRequested: false,
      leaseAttached: false,
      leaseClaimTimer: null,
    };
    this.inspectorSessions.set(sessionId, session);
    this.inspectorSessionIdsByLease.set(leaseId, sessionId);
    this.armInspectorLeaseClaimTimer(session);
    this.appendInspectorLog(session, "system", `bunx ${args.map((arg) => JSON.stringify(arg)).join(" ")}`);
    this.emitInspectorSnapshot(session);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      this.appendInspectorLog(session, "stdout", chunk);
    });
    child.stderr.on("data", (chunk: string) => {
      this.appendInspectorLog(session, "stderr", chunk);
    });
    child.on("error", (error) => {
      session.error = error.message;
      session.state = "failed";
      session.updatedAt = new Date().toISOString();
      this.appendInspectorLog(session, "system", error.message);
      this.emitInspectorSnapshot(session);
    });
    child.on("exit", (exitCode, signal) => {
      session.exitCode = exitCode;
      session.signal = signal;
      session.state = session.closeRequested ? "closed" : exitCode === 0 ? "exited" : "failed";
      session.updatedAt = new Date().toISOString();
      if (session.closeRequested) {
        session.closedAt = session.updatedAt;
      }
      this.clearInspectorLeaseTimer(session);
      this.inspectorSessionIdsByLease.delete(session.leaseId);
      this.unlinkInspectorConfig(session);
      this.emitInspectorSnapshot(session);
    });

    return this.snapshotInspectorSession(session);
  }

  inspectorSnapshot(input: McpInspectorCloseInput): McpInspectorSessionSnapshot {
    return this.snapshotInspectorSession(this.requireInspectorSession(input.sessionId));
  }

  async inspectorClose(input: McpInspectorCloseInput): Promise<McpInspectorSessionSnapshot> {
    const session = this.requireInspectorSession(input.sessionId);
    session.closeRequested = true;
    session.state = "closed";
    session.closedAt = new Date().toISOString();
    session.updatedAt = session.closedAt;
    this.clearInspectorLeaseTimer(session);
    this.inspectorSessionIdsByLease.delete(session.leaseId);
    this.killInspectorProcess(session);
    this.unlinkInspectorConfig(session);
    this.appendInspectorLog(session, "system", "inspector session closed");
    this.emitInspectorSnapshot(session);
    return this.snapshotInspectorSession(session);
  }

  subscribeInspector(sessionId: string, listener: (event: McpInspectorEvent) => void): () => void {
    const listeners = this.inspectorListeners.get(sessionId) ?? new Set<(event: McpInspectorEvent) => void>();
    listeners.add(listener);
    this.inspectorListeners.set(sessionId, listeners);
    const session = this.inspectorSessions.get(sessionId);
    if (session) {
      listener({ type: "snapshot", session: this.snapshotInspectorSession(session) });
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.inspectorListeners.delete(sessionId);
      }
    };
  }

  attachInspectorLease(leaseId: string, listener: (event: McpInspectorEvent) => void): () => void {
    const session = this.requireInspectorSessionByLease(leaseId);
    if (session.leaseAttached) {
      throw new Error(`mcp inspector lease already attached: ${leaseId}`);
    }
    session.leaseAttached = true;
    this.clearInspectorLeaseTimer(session);
    const unsubscribe = this.subscribeInspector(session.sessionId, listener);
    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      unsubscribe();
      session.leaseAttached = false;
      if (this.isInspectorTerminal(session)) {
        return;
      }
      void this.inspectorClose({ sessionId: session.sessionId }).catch(() => undefined);
    };
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
    return this.resolveLaunchEnv(global.env);
  }

  private resolveLaunchEnv(globalEnv: Record<string, string> | undefined): Record<string, string> {
    return {
      ...process.env,
      HOME: this.rootWorkspacePath,
      ...this.baseEnv,
      ...(this.envProvider?.() ?? {}),
      ...(globalEnv ?? {}),
    };
  }

  private async connectEphemeral(input: {
    name: string;
    projectPath: string;
    transport: McpTransportConfig;
    env?: Record<string, string>;
  }): Promise<{ client: Client; transport: Transport; snapshot: McpCapabilitySnapshot }> {
    const client = new Client({
      name: this.clientName,
      version: this.clientVersion,
    });
    const transport = this.transportFactory({
      name: input.name,
      projectPath: input.projectPath,
      transport: input.transport,
      env: this.resolveLaunchEnv(input.env),
    });
    await client.connect(transport);
    const snapshot = await this.discover({
      client,
      name: input.name,
      projectPath: input.projectPath,
      transport: input.transport,
    });
    return {
      client,
      transport,
      snapshot,
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
    const resourceTemplates = capabilities?.resources
      ? await safeList<unknown>(() => input.client.listResourceTemplates(undefined, { timeout: 30_000 }), "resourceTemplates")
      : [];
    const prompts = capabilities?.prompts
      ? await safeList<unknown>(() => input.client.listPrompts(undefined, { timeout: 30_000 }), "prompts")
      : [];
    const apps = extractMcpApps({ tools, resources, resourceTemplates });
    const server = input.client.getServerVersion();
    const snapshotAt = new Date().toISOString();
    return {
      name: input.name,
      projectPath: input.projectPath,
      serverName: server?.name,
      serverVersion: server?.version,
      tools,
      resources,
      resourceTemplates,
      prompts,
      apps,
      snapshot: {
        server,
        capabilities,
        apps,
        resourceTemplates,
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

  private requireProbeSession(probeId: string): McpProbeSession {
    const session = this.probeSessions.get(probeId.trim());
    if (!session) {
      throw new Error(`mcp probe not found: ${probeId}`);
    }
    return session;
  }

  private requireInspectorSession(sessionId: string): McpInspectorSession {
    const session = this.inspectorSessions.get(sessionId.trim());
    if (!session) {
      throw new Error(`mcp inspector not found: ${sessionId}`);
    }
    return session;
  }

  private requireInspectorSessionByLease(leaseId: string): McpInspectorSession {
    const sessionId = this.inspectorSessionIdsByLease.get(leaseId.trim());
    if (!sessionId) {
      throw new Error(`mcp inspector lease not found: ${leaseId}`);
    }
    return this.requireInspectorSession(sessionId);
  }

  private snapshotInspectorSession(session: McpInspectorSession): McpInspectorSessionSnapshot {
    return {
      sessionId: session.sessionId,
      leaseId: session.leaseId,
      state: session.state,
      url: session.url,
      command: session.command,
      args: [...session.args],
      cwd: session.cwd,
      logs: session.logs.map((entry) => ({ ...entry })),
      exitCode: session.exitCode,
      signal: session.signal,
      error: session.error,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      closedAt: session.closedAt,
    };
  }

  private isInspectorTerminal(session: McpInspectorSession): boolean {
    return session.state === "closed" || session.state === "exited" || session.state === "failed";
  }

  private armInspectorLeaseClaimTimer(session: McpInspectorSession): void {
    this.clearInspectorLeaseTimer(session);
    session.leaseClaimTimer = setTimeout(() => {
      if (session.leaseAttached || this.isInspectorTerminal(session)) {
        return;
      }
      void this.inspectorClose({ sessionId: session.sessionId }).catch(() => undefined);
    }, INSPECTOR_LEASE_CLAIM_TIMEOUT_MS);
    session.leaseClaimTimer.unref?.();
  }

  private clearInspectorLeaseTimer(session: McpInspectorSession): void {
    if (!session.leaseClaimTimer) {
      return;
    }
    clearTimeout(session.leaseClaimTimer);
    session.leaseClaimTimer = null;
  }

  private appendInspectorLog(session: McpInspectorSession, stream: McpInspectorLogEntry["stream"], text: string): void {
    const cleanText = stripAnsi(text);
    if (!cleanText) {
      return;
    }
    const entry = {
      id: session.nextLogId++,
      stream,
      text: cleanText,
      createdAt: new Date().toISOString(),
    } satisfies McpInspectorLogEntry;
    session.logs = [...session.logs, entry].slice(-INSPECTOR_LOG_LIMIT);
    session.updatedAt = entry.createdAt;
    this.captureInspectorUrl(session, cleanText);
    this.emitInspectorEvent({
      type: "log",
      sessionId: session.sessionId,
      entry,
      session: this.snapshotInspectorSession(session),
    });
  }

  private captureInspectorUrl(session: McpInspectorSession, text: string): void {
    const urls = [...text.matchAll(inspectorUrlPattern)].map((match) => match[0]);
    const preferredUrl =
      urls.find((url) => url.includes("MCP_PROXY_AUTH_TOKEN")) ??
      urls.find((url) => url.includes("127.0.0.1") || url.includes("localhost")) ??
      null;
    if (!preferredUrl || session.url) {
      return;
    }
    session.url = preferredUrl;
    session.state = "ready";
  }

  private emitInspectorSnapshot(session: McpInspectorSession): void {
    this.emitInspectorEvent({ type: "snapshot", session: this.snapshotInspectorSession(session) });
  }

  private emitInspectorEvent(event: McpInspectorEvent): void {
    const listeners = this.inspectorListeners.get(
      event.type === "snapshot" ? event.session.sessionId : event.sessionId,
    );
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener(event);
    }
  }

  private killInspectorProcess(session: McpInspectorSession): void {
    if (session.child.exitCode !== null || session.child.killed) {
      return;
    }
    try {
      if (process.platform !== "win32" && session.child.pid) {
        process.kill(-session.child.pid, "SIGTERM");
      } else {
        session.child.kill("SIGTERM");
      }
    } catch {
      session.child.kill("SIGTERM");
    }
  }

  private unlinkInspectorConfig(session: McpInspectorSession): void {
    try {
      unlinkSync(session.configPath);
    } catch {
      // Temp config cleanup is best-effort; the file lives under the Avatar private tmp directory.
    }
  }

  private formatProbeResult(
    input: McpProbeInput,
    result: { parsed?: unknown; stderr?: string; exitCode: number },
  ): McpProbeCliResult {
    const stdout = result.exitCode === 0 ? `${JSON.stringify(result.parsed ?? {}, null, 2)}\n` : "";
    return {
      command: "mcp probe",
      stdin: JSON.stringify(input, null, 2),
      stdout,
      stderr: result.stderr ?? "",
      exitCode: result.exitCode,
      parsed: result.parsed,
    };
  }
}

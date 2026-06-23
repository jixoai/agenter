import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptionsWithoutStdio } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";

import {
  getToolUiResourceUri,
  INITIALIZE_METHOD,
  INITIALIZED_METHOD,
  isToolVisibilityModelOnly,
  LATEST_PROTOCOL_VERSION,
  RESOURCE_MIME_TYPE,
  TOOL_INPUT_METHOD,
  TOOL_RESULT_METHOD,
} from "@modelcontextprotocol/ext-apps/app-bridge";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import { McpSystemStore } from "./store";
import type {
  McpAddInput,
  McpAppServerCloseInput,
  McpAppServerEvent,
  McpAppServerLeaseHandle,
  McpAppServerResourceSnapshot,
  McpAppServerSessionSnapshot,
  McpAppServerStartInput,
  McpAppServerState,
  McpCallInput,
  McpCallResult,
  McpCapabilitySnapshot,
  McpDisableInput,
  McpGlobalConfig,
  McpInspectInput,
  McpInspectorCloseInput,
  McpInspectorEvent,
  McpInspectorLogEntry,
  McpInspectorSessionSnapshot,
  McpInspectorStartInput,
  McpInspectorState,
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
  discoverySettleMs?: number;
  discoveryPollMs?: number;
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
  proxyPort: number;
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

type McpJsonRpcId = string | number | null;

interface McpJsonRpcMessage {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}

interface McpAppServerSession {
  sessionId: string;
  leaseId: string;
  state: McpAppServerState;
  client: Client;
  transport: Transport;
  name: string;
  projectPath: string;
  snapshot: McpCapabilitySnapshot;
  resource: McpAppServerResourceSnapshot;
  toolName?: string;
  toolArguments?: McpJsonObject;
  toolResult?: unknown;
  error?: string;
  startedAt: string;
  updatedAt: string;
  closedAt?: string;
  leaseAttached: boolean;
  initialized: boolean;
  initialPayloadSent: boolean;
  closeRequested: boolean;
  leaseClaimTimer: ReturnType<typeof setTimeout> | null;
}

interface McpDiscoveredLists {
  tools: unknown[];
  resources: unknown[];
  resourceTemplates: unknown[];
  prompts: unknown[];
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
const APP_SERVER_LEASE_CLAIM_TIMEOUT_MS = 30_000;
const APP_SERVER_PROTOCOL_VERSION = LATEST_PROTOCOL_VERSION;

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

const safePaginatedList = async <T>(
  operation: (request: { cursor?: string } | undefined) => Promise<{ [key: string]: unknown; nextCursor?: unknown }>,
  key: string,
): Promise<T[]> => {
  try {
    const items: T[] = [];
    let cursor: string | undefined;
    while (true) {
      const result = await operation(cursor ? { cursor } : {});
      const value = result[key];
      if (Array.isArray(value)) {
        items.push(...(value as T[]));
      }
      const nextCursor =
        typeof result.nextCursor === "string" && result.nextCursor.trim().length > 0 ? result.nextCursor.trim() : null;
      if (!nextCursor) {
        return items;
      }
      cursor = nextCursor;
    }
  } catch {
    return [];
  }
};

const sleep = async (ms: number): Promise<void> => {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const hasListGrowth = (previous: McpDiscoveredLists, next: McpDiscoveredLists): boolean =>
  next.tools.length > previous.tools.length ||
  next.resources.length > previous.resources.length ||
  next.resourceTemplates.length > previous.resourceTemplates.length ||
  next.prompts.length > previous.prompts.length;

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
  if (!isRecord(tool)) {
    return null;
  }
  try {
    return (
      getToolUiResourceUri(tool as Partial<Tool>) ??
      (isRecord(tool._meta) ? readString(tool._meta, "openai/outputTemplate") : null)
    );
  } catch {
    return null;
  }
};

const isMcpAppMimeType = (value: unknown): value is typeof RESOURCE_MIME_TYPE =>
  typeof value === "string" &&
  value
    .toLowerCase()
    .split(";")
    .map((part) => part.trim())
    .includes("profile=mcp-app");

const decodeBase64Utf8 = (value: string): string => Buffer.from(value, "base64").toString("utf8");

const readNestedRecord = (value: unknown, path: readonly string[]): Record<string, unknown> | null => {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) {
      return null;
    }
    current = current[key];
  }
  return isRecord(current) ? current : null;
};

const readUiMeta = (content: unknown, listing: unknown): Record<string, unknown> | null =>
  readNestedRecord(content, ["_meta", "ui"]) ??
  readNestedRecord(content, ["meta", "ui"]) ??
  readNestedRecord(listing, ["_meta", "ui"]) ??
  readNestedRecord(listing, ["meta", "ui"]);

const readJsonRpcId = (value: unknown): McpJsonRpcId | undefined =>
  typeof value === "string" || typeof value === "number" || value === null ? value : undefined;

const normalizeJsonRpcMessage = (value: unknown): McpJsonRpcMessage | null => (isRecord(value) ? value : null);

const createJsonRpcResult = (id: McpJsonRpcId, result: unknown): McpJsonObject => ({
  jsonrpc: "2.0",
  id,
  result,
});

const createJsonRpcError = (id: McpJsonRpcId, code: number, message: string): McpJsonObject => ({
  jsonrpc: "2.0",
  id,
  error: {
    code,
    message,
  },
});

const createJsonRpcNotification = (method: string, params: unknown): McpJsonObject => ({
  jsonrpc: "2.0",
  method,
  params,
});

const findNamedCapability = (items: unknown[], name: string): unknown | null =>
  items.find((item) => readString(item, "name") === name) ?? null;

const isToolCallableFromApp = (tool: unknown): boolean =>
  isRecord(tool) && !isToolVisibilityModelOnly(tool as Partial<Tool>);

const readStringFromRecord = (value: Record<string, unknown>, key: string): string | null => {
  const candidate = value[key];
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
};

const readJsonObject = (value: unknown): McpJsonObject | undefined => (isRecord(value) ? { ...value } : undefined);

const readJsonObjectRecord = (value: unknown, key: string): McpJsonObject | undefined =>
  isRecord(value) ? readJsonObject(value[key]) : undefined;

const readResourceContents = (value: unknown): unknown[] => {
  if (!isRecord(value)) {
    return [];
  }
  return Array.isArray(value.contents) ? value.contents : [];
};

const readMcpAppHtmlContent = (content: unknown): { html: string; mimeType: string } | null => {
  if (!isRecord(content) || !isMcpAppMimeType(content.mimeType)) {
    return null;
  }
  if (typeof content.text === "string") {
    return { html: content.text, mimeType: content.mimeType };
  }
  if (typeof content.blob === "string") {
    return { html: decodeBase64Utf8(content.blob), mimeType: content.mimeType };
  }
  return null;
};

const readToolCallParams = (params: unknown): { name: string; arguments?: McpJsonObject } | null => {
  if (!isRecord(params)) {
    return null;
  }
  const name = readStringFromRecord(params, "name");
  if (!name) {
    return null;
  }
  return {
    name,
    arguments: readJsonObjectRecord(params, "arguments"),
  };
};

const readPromptGetParams = (params: unknown): { name: string; arguments?: McpJsonObject } | null => {
  if (!isRecord(params)) {
    return null;
  }
  const name = readStringFromRecord(params, "name");
  if (!name) {
    return null;
  }
  return {
    name,
    arguments: readJsonObjectRecord(params, "arguments"),
  };
};

const readResourceReadParams = (params: unknown): { uri: string } | null => {
  if (!isRecord(params)) {
    return null;
  }
  const uri = readStringFromRecord(params, "uri");
  return uri ? { uri } : null;
};

const extractMcpApps = (input: { tools: unknown[]; resources: unknown[]; resourceTemplates: unknown[] }): unknown[] => {
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
  private readonly discoverySettleMs: number;
  private readonly discoveryPollMs: number;
  private readonly sessions = new Map<string, McpLiveSession>();
  private readonly probeSessions = new Map<string, McpProbeSession>();
  private readonly inspectorSessions = new Map<string, McpInspectorSession>();
  private readonly inspectorSessionIdsByLease = new Map<string, string>();
  private readonly inspectorListeners = new Map<string, Set<(event: McpInspectorEvent) => void>>();
  private readonly appServerSessions = new Map<string, McpAppServerSession>();
  private readonly appServerSessionIdsByLease = new Map<string, string>();
  private readonly appServerListeners = new Map<string, Set<(event: McpAppServerEvent) => void>>();
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
    this.discoverySettleMs = Math.max(0, options.discoverySettleMs ?? 2_500);
    this.discoveryPollMs = Math.max(25, options.discoveryPollMs ?? 150);
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
    for (const session of this.appServerSessions.values()) {
      this.clearAppServerLeaseTimer(session);
      void session.client.close().catch(() => undefined);
    }
    this.appServerSessions.clear();
    this.appServerSessionIdsByLease.clear();
    this.appServerListeners.clear();
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
      const capabilityKind =
        input.capabilityKind ?? (input.toolName ? "tool" : input.resourceUri ? "resource" : "prompt");
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
        HOST: "localhost",
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
      proxyPort: serverPort,
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

  async appServerStart(input: McpAppServerStartInput): Promise<McpAppServerSessionSnapshot> {
    const name = input.name?.trim() || "app-server";
    const projectPath = input.projectPath ? normalizeProjectPath(input.projectPath) : this.rootWorkspacePath;
    const connection = await this.connectEphemeral({
      name,
      projectPath,
      transport: input.transport,
      env: input.env,
    });
    try {
      const appContext = await this.resolveAppServerResource({
        client: connection.client,
        snapshot: connection.snapshot,
        toolName: input.toolName,
        resourceUri: input.resourceUri,
        arguments: input.arguments,
      });
      const now = new Date().toISOString();
      const sessionId = randomUUID();
      const leaseId = randomUUID();
      const session: McpAppServerSession = {
        sessionId,
        leaseId,
        state: "ready",
        client: connection.client,
        transport: connection.transport,
        name,
        projectPath,
        snapshot: connection.snapshot,
        resource: appContext.resource,
        toolName: appContext.toolName,
        toolArguments: appContext.toolArguments,
        toolResult: appContext.toolResult,
        startedAt: now,
        updatedAt: now,
        leaseAttached: false,
        initialized: false,
        initialPayloadSent: false,
        closeRequested: false,
        leaseClaimTimer: null,
      };
      this.appServerSessions.set(sessionId, session);
      this.appServerSessionIdsByLease.set(leaseId, sessionId);
      this.armAppServerLeaseClaimTimer(session);
      this.emitAppServerSnapshot(session);
      return this.snapshotAppServerSession(session);
    } catch (error) {
      await connection.client.close().catch(() => undefined);
      throw error;
    }
  }

  appServerSnapshot(input: McpAppServerCloseInput): McpAppServerSessionSnapshot {
    return this.snapshotAppServerSession(this.requireAppServerSession(input.sessionId));
  }

  async appServerClose(input: McpAppServerCloseInput): Promise<McpAppServerSessionSnapshot> {
    const session = this.requireAppServerSession(input.sessionId);
    if (session.state === "closed") {
      return this.snapshotAppServerSession(session);
    }
    session.closeRequested = true;
    session.state = "closed";
    session.closedAt = new Date().toISOString();
    session.updatedAt = session.closedAt;
    this.clearAppServerLeaseTimer(session);
    this.appServerSessionIdsByLease.delete(session.leaseId);
    await session.client.close().catch(() => undefined);
    this.emitAppServerSnapshot(session);
    return this.snapshotAppServerSession(session);
  }

  subscribeAppServer(sessionId: string, listener: (event: McpAppServerEvent) => void): () => void {
    const listeners = this.appServerListeners.get(sessionId) ?? new Set<(event: McpAppServerEvent) => void>();
    listeners.add(listener);
    this.appServerListeners.set(sessionId, listeners);
    const session = this.appServerSessions.get(sessionId);
    if (session) {
      listener({ type: "snapshot", session: this.snapshotAppServerSession(session) });
    }
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.appServerListeners.delete(sessionId);
      }
    };
  }

  readAppServerLeaseResource(leaseId: string): McpAppServerResourceSnapshot {
    const session = this.requireAppServerSessionByLease(leaseId);
    return {
      ...session.resource,
      csp: session.resource.csp ? { ...session.resource.csp } : undefined,
      permissions: session.resource.permissions ? { ...session.resource.permissions } : undefined,
    };
  }

  attachAppServerLease(leaseId: string, listener: (event: McpAppServerEvent) => void): McpAppServerLeaseHandle {
    const session = this.requireAppServerSessionByLease(leaseId);
    if (session.leaseAttached) {
      throw new Error(`mcp app-server lease already attached: ${leaseId}`);
    }
    session.leaseAttached = true;
    this.clearAppServerLeaseTimer(session);
    const unsubscribe = this.subscribeAppServer(session.sessionId, listener);
    listener({
      type: "resource",
      sessionId: session.sessionId,
      resource: session.resource,
      session: this.snapshotAppServerSession(session),
    });
    let released = false;
    return {
      receive: async (message: unknown) => {
        await this.receiveAppServerMessage(session, message);
      },
      release: () => {
        if (released) {
          return;
        }
        released = true;
        unsubscribe();
        session.leaseAttached = false;
        if (this.isAppServerTerminal(session)) {
          return;
        }
        void this.appServerClose({ sessionId: session.sessionId }).catch(() => undefined);
      },
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
    const { tools, resources, resourceTemplates, prompts } = await this.discoverLists(
      input.client,
      Boolean(capabilities?.resources),
    );
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

  private async readDiscoveredLists(client: Client): Promise<McpDiscoveredLists> {
    const tools = await safePaginatedList<unknown>(
      (request) => client.listTools(request, { timeout: 30_000 }),
      "tools",
    );
    const resources = await safePaginatedList<unknown>(
      (request) => client.listResources(request, { timeout: 30_000 }),
      "resources",
    );
    const resourceTemplates = await safePaginatedList<unknown>(
      (request) => client.listResourceTemplates(request, { timeout: 30_000 }),
      "resourceTemplates",
    );
    const prompts = await safePaginatedList<unknown>(
      (request) => client.listPrompts(request, { timeout: 30_000 }),
      "prompts",
    );
    return { tools, resources, resourceTemplates, prompts };
  }

  private async discoverLists(client: Client, shouldSettleResources: boolean): Promise<McpDiscoveredLists> {
    let latest = await this.readDiscoveredLists(client);
    const hasResourceSurface =
      shouldSettleResources || latest.resources.length > 0 || latest.resourceTemplates.length > 0;
    if (!hasResourceSurface || this.discoverySettleMs <= 0) {
      return latest;
    }

    const deadline = Date.now() + this.discoverySettleMs;
    let observedGrowth = false;
    while (Date.now() < deadline) {
      await sleep(Math.min(this.discoveryPollMs, Math.max(0, deadline - Date.now())));
      const next = await this.readDiscoveredLists(client);
      const merged: McpDiscoveredLists = {
        tools: next.tools.length >= latest.tools.length ? next.tools : latest.tools,
        resources: next.resources.length >= latest.resources.length ? next.resources : latest.resources,
        resourceTemplates:
          next.resourceTemplates.length >= latest.resourceTemplates.length
            ? next.resourceTemplates
            : latest.resourceTemplates,
        prompts: next.prompts.length >= latest.prompts.length ? next.prompts : latest.prompts,
      };
      const grew = hasListGrowth(latest, merged);
      latest = merged;
      if (grew) {
        observedGrowth = true;
        continue;
      }
      if (observedGrowth) {
        return latest;
      }
    }
    return latest;
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
    return session.state === "closed";
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
    session.url = this.decorateInspectorUrl(preferredUrl, session.proxyPort);
    session.state = "ready";
  }

  private decorateInspectorUrl(url: string, proxyPort: number): string {
    try {
      const resolved = new URL(url);
      resolved.searchParams.set("MCP_PROXY_PORT", String(proxyPort));
      return resolved.toString();
    } catch {
      return url;
    }
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

  private async resolveAppServerResource(input: {
    client: Client;
    snapshot: McpCapabilitySnapshot;
    toolName?: string;
    resourceUri?: string;
    arguments?: McpJsonObject;
  }): Promise<{
    resource: McpAppServerResourceSnapshot;
    toolName?: string;
    toolArguments?: McpJsonObject;
    toolResult?: unknown;
  }> {
    const toolName = input.toolName?.trim() || undefined;
    const toolArguments = input.arguments ?? {};
    let resourceUri = input.resourceUri?.trim() || undefined;
    let toolResult: unknown;

    if (toolName) {
      const tool = findNamedCapability(input.snapshot.tools, toolName);
      if (!tool) {
        throw new Error(`mcp app tool not found: ${toolName}`);
      }
      resourceUri = resourceUri ?? resolveMcpAppResourceUri(tool) ?? undefined;
      if (!resourceUri) {
        throw new Error(`mcp app tool has no ui resource: ${toolName}`);
      }
      toolResult = await input.client.callTool({
        name: toolName,
        arguments: toolArguments,
      });
    }

    if (!resourceUri) {
      throw new Error("mcp app-server requires resourceUri or toolName");
    }

    const readResult = await input.client.readResource({ uri: resourceUri });
    const contents = readResourceContents(readResult);
    const content =
      contents.find(
        (item) => isRecord(item) && readString(item, "uri") === resourceUri && readMcpAppHtmlContent(item),
      ) ?? contents.find((item) => readMcpAppHtmlContent(item));
    const htmlContent = readMcpAppHtmlContent(content);
    if (!htmlContent) {
      throw new Error(`mcp resource is not an MCP App HTML resource: ${resourceUri}`);
    }

    const listing =
      findNamedCapability(input.snapshot.resources, resourceUri) ??
      input.snapshot.resources.find((resource) => isRecord(resource) && readString(resource, "uri") === resourceUri) ??
      input.snapshot.resourceTemplates?.find(
        (template) => isRecord(template) && readString(template, "uriTemplate") === resourceUri,
      ) ??
      null;
    const uiMeta = readUiMeta(content, listing);
    return {
      resource: {
        uri: resourceUri,
        mimeType: RESOURCE_MIME_TYPE,
        html: htmlContent.html,
        csp: readJsonObjectRecord(uiMeta, "csp"),
        permissions: readJsonObjectRecord(uiMeta, "permissions"),
      },
      toolName,
      toolArguments: toolName ? toolArguments : undefined,
      toolResult,
    };
  }

  private requireAppServerSession(sessionId: string): McpAppServerSession {
    const session = this.appServerSessions.get(sessionId.trim());
    if (!session) {
      throw new Error(`mcp app-server not found: ${sessionId}`);
    }
    return session;
  }

  private requireAppServerSessionByLease(leaseId: string): McpAppServerSession {
    const sessionId = this.appServerSessionIdsByLease.get(leaseId.trim());
    if (!sessionId) {
      throw new Error(`mcp app-server lease not found: ${leaseId}`);
    }
    return this.requireAppServerSession(sessionId);
  }

  private snapshotAppServerSession(session: McpAppServerSession): McpAppServerSessionSnapshot {
    return {
      sessionId: session.sessionId,
      leaseId: session.leaseId,
      state: session.state,
      command: "mcp app-server",
      name: session.name,
      projectPath: session.projectPath,
      resourceUri: session.resource.uri,
      toolName: session.toolName,
      toolArguments: session.toolArguments,
      toolResult: session.toolResult,
      hostPath: `/mcp/apps/${encodeURIComponent(session.leaseId)}/host`,
      wsPath: `/mcp/apps/${encodeURIComponent(session.leaseId)}/ws`,
      error: session.error,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      closedAt: session.closedAt,
    };
  }

  private isAppServerTerminal(session: McpAppServerSession): boolean {
    return session.state === "closed";
  }

  private armAppServerLeaseClaimTimer(session: McpAppServerSession): void {
    this.clearAppServerLeaseTimer(session);
    session.leaseClaimTimer = setTimeout(() => {
      if (session.leaseAttached || this.isAppServerTerminal(session)) {
        return;
      }
      void this.appServerClose({ sessionId: session.sessionId }).catch(() => undefined);
    }, APP_SERVER_LEASE_CLAIM_TIMEOUT_MS);
    session.leaseClaimTimer.unref?.();
  }

  private clearAppServerLeaseTimer(session: McpAppServerSession): void {
    if (!session.leaseClaimTimer) {
      return;
    }
    clearTimeout(session.leaseClaimTimer);
    session.leaseClaimTimer = null;
  }

  private emitAppServerSnapshot(session: McpAppServerSession): void {
    this.emitAppServerEvent({ type: "snapshot", session: this.snapshotAppServerSession(session) });
  }

  private emitAppServerOutgoingMessage(session: McpAppServerSession, message: McpJsonObject): void {
    this.emitAppServerEvent({
      type: "message",
      sessionId: session.sessionId,
      message,
      session: this.snapshotAppServerSession(session),
    });
  }

  private emitAppServerEvent(event: McpAppServerEvent): void {
    const listeners = this.appServerListeners.get(
      event.type === "snapshot" ? event.session.sessionId : event.sessionId,
    );
    if (!listeners) {
      return;
    }
    for (const listener of listeners) {
      listener(event);
    }
  }

  private async receiveAppServerMessage(session: McpAppServerSession, value: unknown): Promise<void> {
    if (Array.isArray(value)) {
      for (const item of value) {
        await this.receiveAppServerMessage(session, item);
      }
      return;
    }
    const message = normalizeJsonRpcMessage(value);
    if (!message) {
      return;
    }
    const method = typeof message.method === "string" ? message.method : null;
    if (!method) {
      return;
    }
    const id = readJsonRpcId(message.id);
    if (id === undefined) {
      await this.handleAppServerNotification(session, method, message.params);
      return;
    }
    try {
      const result = await this.handleAppServerRequest(session, method, message.params);
      this.emitAppServerOutgoingMessage(session, createJsonRpcResult(id, result));
    } catch (error) {
      this.emitAppServerOutgoingMessage(session, createJsonRpcError(id, -32000, actionError(error)));
    }
  }

  private async handleAppServerNotification(
    session: McpAppServerSession,
    method: string,
    params: unknown,
  ): Promise<void> {
    session.updatedAt = new Date().toISOString();
    if (method === INITIALIZED_METHOD) {
      session.initialized = true;
      this.emitAppServerSnapshot(session);
      this.sendInitialAppServerPayload(session);
      return;
    }
    if (method === "ui/notifications/request-teardown") {
      await this.appServerClose({ sessionId: session.sessionId });
      return;
    }
    if (method === "notifications/message" && isRecord(params)) {
      session.error = readString(params, "level") === "error" ? JSON.stringify(params.data ?? params) : session.error;
      this.emitAppServerSnapshot(session);
    }
  }

  private sendInitialAppServerPayload(session: McpAppServerSession): void {
    if (session.initialPayloadSent) {
      return;
    }
    session.initialPayloadSent = true;
    if (session.toolName) {
      this.emitAppServerOutgoingMessage(
        session,
        createJsonRpcNotification(TOOL_INPUT_METHOD, {
          arguments: session.toolArguments ?? {},
        }),
      );
    }
    if (session.toolResult !== undefined) {
      this.emitAppServerOutgoingMessage(session, createJsonRpcNotification(TOOL_RESULT_METHOD, session.toolResult));
    }
  }

  private async handleAppServerRequest(
    session: McpAppServerSession,
    method: string,
    params: unknown,
  ): Promise<unknown> {
    if (method === INITIALIZE_METHOD) {
      const tool = session.toolName
        ? (findNamedCapability(session.snapshot.tools, session.toolName) as Tool | null)
        : null;
      return {
        protocolVersion: APP_SERVER_PROTOCOL_VERSION,
        hostInfo: {
          name: "agenter-mcp-app-server",
          version: this.clientVersion,
        },
        hostCapabilities: {
          serverTools: {},
          serverResources: {},
          logging: {},
          message: {
            text: {},
            image: {},
            resource: {},
            resourceLink: {},
            structuredContent: {},
          },
          updateModelContext: {
            text: {},
            image: {},
            resource: {},
            resourceLink: {},
            structuredContent: {},
          },
          sandbox: {
            csp: session.resource.csp,
            permissions: session.resource.permissions,
          },
        },
        hostContext: {
          toolInfo: tool
            ? {
                tool,
              }
            : undefined,
          theme: "light",
          displayMode: "inline",
          availableDisplayModes: ["inline", "fullscreen"],
          platform: "web",
          userAgent: "agenter-studio",
        },
      };
    }
    if (method === "ping") {
      return {};
    }
    if (method === "tools/list") {
      return {
        tools: session.snapshot.tools.filter(isToolCallableFromApp),
      };
    }
    if (method === "tools/call") {
      const toolCall = readToolCallParams(params);
      if (!toolCall) {
        throw new Error("tools/call requires params.name");
      }
      const tool = findNamedCapability(session.snapshot.tools, toolCall.name);
      if (!tool || !isToolCallableFromApp(tool)) {
        throw new Error(`mcp app cannot call tool: ${toolCall.name}`);
      }
      return await session.client.callTool({
        name: toolCall.name,
        arguments: toolCall.arguments ?? {},
      });
    }
    if (method === "resources/list") {
      return {
        resources: session.snapshot.resources,
      };
    }
    if (method === "resources/templates/list") {
      return {
        resourceTemplates: session.snapshot.resourceTemplates ?? [],
      };
    }
    if (method === "resources/read") {
      const readParams = readResourceReadParams(params);
      if (!readParams) {
        throw new Error("resources/read requires params.uri");
      }
      return await session.client.readResource(readParams);
    }
    if (method === "prompts/list") {
      return {
        prompts: session.snapshot.prompts,
      };
    }
    if (method === "prompts/get") {
      const promptParams = readPromptGetParams(params);
      if (!promptParams) {
        throw new Error("prompts/get requires params.name");
      }
      return await session.client.getPrompt({
        name: promptParams.name,
        arguments: createPromptArguments(promptParams.arguments),
      });
    }
    if (method === "ui/message" || method === "ui/update-model-context") {
      return {};
    }
    if (method === "ui/open-link" || method === "ui/download-file") {
      return { isError: true };
    }
    if (method === "ui/request-display-mode") {
      const requestedMode = isRecord(params) && params.mode === "fullscreen" ? "fullscreen" : "inline";
      return { mode: requestedMode };
    }
    if (method === "ui/resource-teardown") {
      return {};
    }
    throw new Error(`unsupported MCP Apps request: ${method}`);
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

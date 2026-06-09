export type McpTransportKind = "stdio" | "streamable-http" | "sse";

export type McpJsonObject = Record<string, unknown>;

export type McpTransportConfig =
  | {
      kind: "stdio";
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  | {
      kind: "streamable-http";
      url: string;
      headers?: Record<string, string>;
    }
  | {
      kind: "sse";
      url: string;
      headers?: Record<string, string>;
    };

export interface McpGlobalConfig {
  name: string;
  title?: string;
  description?: string;
  transport: McpTransportConfig;
  env?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  removedAt?: string;
}

export interface McpProjectEnablement {
  name: string;
  projectPath: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  enabledAt?: string;
  disabledAt?: string;
  lastUsedAt?: string;
}

export type McpLifecycleState = "starting" | "running" | "stopped" | "failed";

export interface McpCapabilitySnapshot {
  name: string;
  projectPath: string;
  serverName?: string;
  serverVersion?: string;
  protocolVersion?: string;
  tools: unknown[];
  resources: unknown[];
  resourceTemplates?: unknown[];
  prompts: unknown[];
  apps?: unknown[];
  snapshot: McpJsonObject;
  snapshotAt: string;
}

export interface McpInstanceRecord {
  name: string;
  projectPath: string;
  lifecycle: McpLifecycleState;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
  lastStartedAt?: string;
  lastStoppedAt?: string;
}

export interface McpActionRecord {
  actionId: number;
  action: string;
  name: string;
  projectPath: string;
  toolName?: string;
  autoStart?: boolean;
  autoEnable?: boolean;
  status: "success" | "error";
  inputSummary?: string;
  error?: string;
  createdAt: string;
}

export interface McpInstalledRow {
  name: string;
  title: string | null;
  description: string | null;
  transport_kind: McpTransportKind;
  command: string | null;
  args_json: string | null;
  url: string | null;
  headers_json: string | null;
  env_json: string | null;
  created_at: string;
  updated_at: string;
}

export interface McpEnabledRow {
  name: string;
  project_path: string;
  enabled: number;
  enabled_source: "explicit" | "default";
  title: string | null;
  description: string | null;
  transport_kind: McpTransportKind;
  lifecycle: McpLifecycleState | null;
  last_error: string | null;
  server_name: string | null;
  server_version: string | null;
  protocol_version: string | null;
  snapshot_at: string | null;
  tools_json: string | null;
  resources_json: string | null;
  prompts_json: string | null;
  snapshot_json: string | null;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}

export interface McpAddInput {
  name: string;
  transport: McpTransportConfig;
  title?: string;
  description?: string;
  env?: Record<string, string>;
  override?: boolean;
}

export interface McpRemoveInput {
  name: string;
  stop?: boolean;
}

export interface McpProjectInput {
  name: string;
  projectPath: string;
}

export interface McpDisableInput extends McpProjectInput {
  stop?: boolean;
}

export interface McpListInput {
  projectPath: string;
  includeSnapshots?: boolean;
}

export interface McpCallInput extends McpProjectInput {
  toolName: string;
  arguments?: McpJsonObject;
  autoStart?: boolean;
  autoEnable?: boolean;
}

export interface McpInspectInput {
  name?: string;
  projectPath?: string;
  transport: McpTransportConfig;
  env?: Record<string, string>;
  capabilityKind?: "tool" | "resource" | "prompt";
  toolName?: string;
  resourceUri?: string;
  promptName?: string;
  arguments?: McpJsonObject;
}

export type McpProbeInput =
  | {
      action: "open";
      name?: string;
      projectPath?: string;
      transport: McpTransportConfig;
      env?: Record<string, string>;
    }
  | {
      action: "ping";
      probeId: string;
    }
  | {
      action: "call-tool";
      probeId: string;
      toolName: string;
      arguments?: McpJsonObject;
    }
  | {
      action: "read-resource";
      probeId: string;
      resourceUri: string;
    }
  | {
      action: "get-prompt";
      probeId: string;
      promptName: string;
      arguments?: McpJsonObject;
    }
  | {
      action: "complete";
      probeId: string;
      ref: { type: "ref/prompt"; name: string } | { type: "ref/resource"; uri: string };
      argument: { name: string; value: string };
      context?: { arguments?: Record<string, string> };
    }
  | {
      action: "close";
      probeId: string;
    };

export interface McpProbeCliResult {
  command: "mcp probe";
  stdin: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  parsed?: unknown;
}

export interface McpInspectorStartInput {
  name?: string;
  projectPath?: string;
  transport: McpTransportConfig;
  env?: Record<string, string>;
}

export interface McpInspectorCloseInput {
  sessionId: string;
}

export type McpInspectorState = "starting" | "ready" | "exited" | "failed" | "closed";

export interface McpInspectorLogEntry {
  id: number;
  stream: "stdout" | "stderr" | "system";
  text: string;
  createdAt: string;
}

export interface McpInspectorSessionSnapshot {
  sessionId: string;
  state: McpInspectorState;
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
}

export type McpInspectorEvent =
  | {
      type: "snapshot";
      session: McpInspectorSessionSnapshot;
    }
  | {
      type: "log";
      sessionId: string;
      entry: McpInspectorLogEntry;
      session: McpInspectorSessionSnapshot;
    };

export interface McpTransportStartContext {
  name: string;
  projectPath: string;
  transport: McpTransportConfig;
  env: Record<string, string>;
}

export type McpQueryParamValue = string | number | boolean | null;

export interface McpQueryInput {
  sql: string;
  params?: Record<string, McpQueryParamValue>;
  projectPath?: string;
}

export interface McpQueryResult {
  rows: Array<Record<string, string | number | null>>;
}

export interface McpStartResult {
  instance: McpInstanceRecord;
  snapshot?: McpCapabilitySnapshot;
}

export interface McpCallResult {
  result: unknown;
  instance: McpInstanceRecord;
}

export interface McpInspectResult {
  snapshot: McpCapabilitySnapshot;
  result?: unknown;
}

export interface McpSystemSurface {
  add: (input: McpAddInput) => McpGlobalConfig;
  remove: (
    input: McpRemoveInput,
  ) => Promise<{ removed: boolean; blockedProjects: string[] }> | { removed: boolean; blockedProjects: string[] };
  enable: (input: McpProjectInput) => McpProjectEnablement;
  disable: (input: McpDisableInput) => Promise<McpProjectEnablement> | McpProjectEnablement;
  list: (input: McpListInput) => McpEnabledRow[];
  query: (input: McpQueryInput) => McpQueryResult;
  start: (input: McpProjectInput) => Promise<McpStartResult>;
  stop: (input: McpProjectInput) => Promise<{ instance: McpInstanceRecord }>;
  restart: (input: McpProjectInput) => Promise<McpStartResult>;
  call: (input: McpCallInput, options?: { signal?: AbortSignal }) => Promise<McpCallResult>;
  inspect: (input: McpInspectInput, options?: { signal?: AbortSignal }) => Promise<McpInspectResult>;
  probe: (input: McpProbeInput, options?: { signal?: AbortSignal }) => Promise<McpProbeCliResult>;
  inspectorStart: (input: McpInspectorStartInput) => Promise<McpInspectorSessionSnapshot>;
  inspectorSnapshot: (input: McpInspectorCloseInput) => McpInspectorSessionSnapshot;
  inspectorClose: (input: McpInspectorCloseInput) => Promise<McpInspectorSessionSnapshot>;
  subscribeInspector: (sessionId: string, listener: (event: McpInspectorEvent) => void) => () => void;
}

import type { McpGlobalConfigDraft, McpGlobalConfigDraftTransport, McpTransportKind } from "./mcp-workbench-state";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readRequiredString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value.trim();
};

const readOptionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const readStringRecord = (value: unknown, label: string): Record<string, string> | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  const entries = Object.entries(value);
  for (const [, entry] of entries) {
    if (typeof entry !== "string") {
      throw new Error(`${label} must contain only string values`);
    }
  }
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const readStringArray = (value: unknown, label: string): string[] => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be an array of strings`);
  }
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
};

const parseTransport = (value: unknown): McpGlobalConfigDraftTransport => {
  if (!isRecord(value)) {
    throw new Error("transport must be an object");
  }
  const kind = readRequiredString(value.kind, "transport.kind") as McpTransportKind;
  if (kind === "stdio") {
    return {
      kind,
      command: readRequiredString(value.command, "transport.command"),
      args: readStringArray(value.args, "transport.args"),
      env: readStringRecord(value.env, "transport.env"),
    };
  }
  if (kind === "streamable-http" || kind === "sse") {
    return {
      kind,
      url: readRequiredString(value.url, "transport.url"),
      headers: readStringRecord(value.headers, "transport.headers"),
    };
  }
  throw new Error("transport.kind must be one of stdio, streamable-http, or sse");
};

export const serializeMcpDraft = (draft: McpGlobalConfigDraft): string => `${JSON.stringify(draft, null, 2)}\n`;

export const parseMcpDraftJson = (
  source: string,
  options: {
    defaultAvatarNickname: string;
    immutableName?: string | null;
  } = {
    defaultAvatarNickname: "default",
  },
): McpGlobalConfigDraft => {
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) {
    throw new Error("Config JSON must be an object");
  }

  const draft: McpGlobalConfigDraft = {
    avatarNickname: readOptionalString(parsed.avatarNickname, "avatarNickname") ?? options.defaultAvatarNickname,
    name: readRequiredString(parsed.name, "name"),
    title: readOptionalString(parsed.title, "title"),
    description: readOptionalString(parsed.description, "description"),
    transport: parseTransport(parsed.transport),
    env: readStringRecord(parsed.env, "env"),
  };

  if (options.immutableName && draft.name !== options.immutableName) {
    throw new Error(`name is immutable in edit mode and must stay "${options.immutableName}"`);
  }

  return draft;
};

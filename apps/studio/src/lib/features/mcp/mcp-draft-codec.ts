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
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new Error(`${label} must contain only string values`);
    }
    result[key] = entry;
  }
  return Object.keys(result).length > 0 ? result : undefined;
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

const readText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const stripMcpPackageNoise = (value: string): string => {
  let next = value.trim().replace(/^['"]|['"]$/gu, "");
  if (next.startsWith("@") && next.includes("/")) {
    const [scopePart = "", packagePart = ""] = next.slice(1).split("/", 2);
    const scope = scopePart.trim();
    let packageName = packagePart.trim();
    const versionIndex = packageName.lastIndexOf("@");
    if (versionIndex > 0) {
      packageName = packageName.slice(0, versionIndex);
    }
    next = packageName.length === 0 || packageName === "mcp" || packageName === "server" ? scope : packageName;
  } else {
    const versionIndex = next.lastIndexOf("@");
    if (versionIndex > 0) {
      next = next.slice(0, versionIndex);
    }
  }
  let normalized = next.trim();
  let previous = "";
  while (normalized !== previous) {
    previous = normalized;
    normalized = normalized.replace(/^(?:server-|mcp-)/iu, "");
  }
  normalized = normalized.replace(/-(?:mcp|server|app)$/iu, "");
  return normalized.trim();
};

const titleCaseMcpName = (value: string): string =>
  value
    .split(/[-_/]+/u)
    .map((part) => {
      const trimmed = part.trim();
      if (!trimmed) {
        return "";
      }
      return `${trimmed.slice(0, 1).toUpperCase()}${trimmed.slice(1).toLowerCase()}`;
    })
    .filter((part) => part.length > 0)
    .join(" ");

export const deriveMcpConfigIdentityFromArgs = (argsText: string): { name: string; title: string } | null => {
  const launcherTokens = new Set([
    "bun",
    "bunx",
    "deno",
    "dlx",
    "exec",
    "node",
    "npm",
    "npx",
    "pnpm",
    "tsx",
    "ts-node",
    "yarn",
  ]);
  const token = argsText
    .trim()
    .split(/\s+/u)
    .find((entry, index) => {
      if (entry.length === 0 || entry.startsWith("-")) {
        return false;
      }
      if (index === 0 && launcherTokens.has(entry.toLowerCase())) {
        return false;
      }
      return !launcherTokens.has(entry.toLowerCase());
    });
  if (!token) {
    return null;
  }
  const stripped = stripMcpPackageNoise(readText(token));
  if (!stripped) {
    return null;
  }
  return {
    name: stripped,
    title: titleCaseMcpName(stripped),
  };
};

const parseTransport = (value: unknown): McpGlobalConfigDraftTransport => {
  if (!isRecord(value)) {
    throw new Error("transport must be an object");
  }
  const kind = readRequiredString(value.kind, "transport.kind") as McpTransportKind;
  if (kind === "stdio") {
    return {
      kind,
      command: readOptionalString(value.command, "transport.command") ?? "",
      args: readStringArray(value.args, "transport.args"),
      env: readStringRecord(value.env, "transport.env"),
    };
  }
  if (kind === "streamable-http" || kind === "sse") {
    return {
      kind,
      url: readOptionalString(value.url, "transport.url") ?? "",
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
    name: readOptionalString(parsed.name, "name") ?? "",
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

import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface DaemonRuntimeDescriptor {
  pid: number;
  host: string;
  port: number;
  endpoint: string;
  homeDir: string;
  updatedAt: string;
}

export const DAEMON_RUNTIME_DESCRIPTOR_FILENAME = "daemon.runtime.json";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeDaemonRuntimeDescriptor = (value: unknown): DaemonRuntimeDescriptor | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.pid !== "number" || !Number.isInteger(value.pid) || value.pid <= 0) {
    return null;
  }
  if (typeof value.host !== "string" || value.host.length === 0) {
    return null;
  }
  if (typeof value.port !== "number" || !Number.isInteger(value.port) || value.port <= 0) {
    return null;
  }
  if (typeof value.endpoint !== "string" || value.endpoint.length === 0) {
    return null;
  }
  if (typeof value.homeDir !== "string" || value.homeDir.length === 0) {
    return null;
  }
  if (typeof value.updatedAt !== "string" || value.updatedAt.length === 0) {
    return null;
  }
  return {
    pid: value.pid,
    host: value.host,
    port: value.port,
    endpoint: value.endpoint,
    homeDir: value.homeDir,
    updatedAt: value.updatedAt,
  };
};

export const resolveDaemonRuntimeDescriptorPath = (homeDir: string): string =>
  join(resolve(homeDir), ".agenter", DAEMON_RUNTIME_DESCRIPTOR_FILENAME);

export const resolveDaemonLogDir = (homeDir: string): string => join(resolve(homeDir), ".agenter", "logs", "daemon");

export const resolveDaemonLogPath = (
  homeDir: string,
  authority: Pick<DaemonRuntimeDescriptor, "host" | "port">,
  startedAt = new Date(),
): string => {
  const safeHost = authority.host.replace(/[^a-zA-Z0-9_.-]/gu, "_");
  const safeStartedAt = startedAt.toISOString().replace(/[:.]/gu, "-");
  return join(resolveDaemonLogDir(homeDir), `${safeStartedAt}-${safeHost}-${authority.port}.log`);
};

export const readDaemonRuntimeDescriptor = (homeDir: string): DaemonRuntimeDescriptor | null => {
  const filePath = resolveDaemonRuntimeDescriptorPath(homeDir);
  try {
    return normalizeDaemonRuntimeDescriptor(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
};

export const writeDaemonRuntimeDescriptor = (descriptor: DaemonRuntimeDescriptor): void => {
  const filePath = resolveDaemonRuntimeDescriptorPath(descriptor.homeDir);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
};

const sameDaemonRuntimeDescriptorOwner = (
  left: Pick<DaemonRuntimeDescriptor, "pid" | "host" | "port" | "endpoint" | "homeDir">,
  right: Pick<DaemonRuntimeDescriptor, "pid" | "host" | "port" | "endpoint" | "homeDir">,
): boolean =>
  left.pid === right.pid &&
  left.host === right.host &&
  left.port === right.port &&
  left.endpoint === right.endpoint &&
  left.homeDir === right.homeDir;

export const clearOwnedDaemonRuntimeDescriptor = (
  owner: Pick<DaemonRuntimeDescriptor, "pid" | "host" | "port" | "endpoint" | "homeDir">,
): void => {
  const current = readDaemonRuntimeDescriptor(owner.homeDir);
  if (!current || !sameDaemonRuntimeDescriptorOwner(current, owner)) {
    return;
  }
  try {
    unlinkSync(resolveDaemonRuntimeDescriptorPath(owner.homeDir));
  } catch {
    // Best effort only. Stale descriptors are ignored unless health checks pass.
  }
};

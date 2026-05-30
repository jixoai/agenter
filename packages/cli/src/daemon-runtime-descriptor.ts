import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export interface DaemonRuntimeDescriptor {
  pid: number;
  host: string;
  port: number;
  endpoint: string;
  homeDir: string;
  launcher: DaemonLauncherIdentity;
  updatedAt: string;
}

export const DAEMON_RUNTIME_DESCRIPTOR_FILENAME = "daemon.runtime.json";

export interface DaemonLauncherIdentity {
  packageName: string;
  packageVersion: string;
  sourceKind: "workspace" | "package" | "unknown";
  entrypoint: string;
}

export interface DaemonHealthPayload {
  ok: true;
  port: number;
  launcher: DaemonLauncherIdentity;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeDaemonLauncherIdentity = (value: unknown): DaemonLauncherIdentity | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.packageName !== "string" || value.packageName.length === 0) {
    return null;
  }
  if (typeof value.packageVersion !== "string" || value.packageVersion.length === 0) {
    return null;
  }
  if (value.sourceKind !== "workspace" && value.sourceKind !== "package" && value.sourceKind !== "unknown") {
    return null;
  }
  if (typeof value.entrypoint !== "string" || value.entrypoint.length === 0) {
    return null;
  }
  return {
    packageName: value.packageName,
    packageVersion: value.packageVersion,
    sourceKind: value.sourceKind,
    entrypoint: value.entrypoint,
  };
};

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
  // Descriptors written before launcher identity existed can still be stopped,
  // but they are never reusable by identity-aware app launches.
  const launcher = normalizeDaemonLauncherIdentity(value.launcher) ?? {
    packageName: "unknown",
    packageVersion: "unknown",
    sourceKind: "unknown",
    entrypoint: "unknown",
  };
  if (typeof value.updatedAt !== "string" || value.updatedAt.length === 0) {
    return null;
  }
  return {
    pid: value.pid,
    host: value.host,
    port: value.port,
    endpoint: value.endpoint,
    homeDir: value.homeDir,
    launcher,
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
  left: Pick<DaemonRuntimeDescriptor, "pid" | "host" | "port" | "endpoint" | "homeDir" | "launcher">,
  right: Pick<DaemonRuntimeDescriptor, "pid" | "host" | "port" | "endpoint" | "homeDir" | "launcher">,
): boolean =>
  left.pid === right.pid &&
  left.host === right.host &&
  left.port === right.port &&
  left.endpoint === right.endpoint &&
  left.homeDir === right.homeDir &&
  sameDaemonLauncherIdentity(left.launcher, right.launcher);

export const clearOwnedDaemonRuntimeDescriptor = (
  owner: Pick<DaemonRuntimeDescriptor, "pid" | "host" | "port" | "endpoint" | "homeDir" | "launcher">,
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

export const sameDaemonLauncherIdentity = (left: DaemonLauncherIdentity, right: DaemonLauncherIdentity): boolean =>
  left.packageName === right.packageName &&
  left.packageVersion === right.packageVersion &&
  left.sourceKind === right.sourceKind &&
  left.entrypoint === right.entrypoint;

export const compatibleDaemonLauncherIdentity = (
  left: DaemonLauncherIdentity,
  right: DaemonLauncherIdentity,
): boolean => {
  if (
    left.packageName !== right.packageName ||
    left.packageVersion !== right.packageVersion ||
    left.sourceKind !== right.sourceKind
  ) {
    return false;
  }
  if (left.sourceKind === "workspace") {
    return true;
  }
  return left.entrypoint === right.entrypoint;
};

export const normalizeDaemonHealthPayload = (value: unknown): DaemonHealthPayload | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (value.ok !== true) {
    return null;
  }
  if (typeof value.port !== "number" || !Number.isInteger(value.port) || value.port <= 0) {
    return null;
  }
  const launcher = normalizeDaemonLauncherIdentity(value.launcher);
  if (!launcher) {
    return null;
  }
  return {
    ok: true,
    port: value.port,
    launcher,
  };
};

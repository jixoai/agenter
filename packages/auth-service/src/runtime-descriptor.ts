import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { AuthServiceRuntimeDescriptor } from "./types";

export const AUTH_SERVICE_RUNTIME_DESCRIPTOR_FILENAME = "auth-service.runtime.json";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const normalizeAuthServiceRuntimeDescriptor = (value: unknown): AuthServiceRuntimeDescriptor | null => {
  if (!isRecord(value)) {
    return null;
  }
  if (typeof value.pid !== "number" || !Number.isInteger(value.pid) || value.pid <= 0) {
    return null;
  }
  if (typeof value.endpoint !== "string" || value.endpoint.length === 0) {
    return null;
  }
  if (typeof value.dataDir !== "string" || value.dataDir.length === 0) {
    return null;
  }
  if (typeof value.rootAuthKeyPath !== "string" || value.rootAuthKeyPath.length === 0) {
    return null;
  }
  if (typeof value.updatedAt !== "string" || value.updatedAt.length === 0) {
    return null;
  }
  return {
    pid: value.pid,
    endpoint: value.endpoint,
    dataDir: value.dataDir,
    rootAuthKeyPath: value.rootAuthKeyPath,
    updatedAt: value.updatedAt,
  };
};

export const resolveAuthServiceRuntimeDescriptorPath = (dataDir: string): string =>
  join(resolve(dataDir), AUTH_SERVICE_RUNTIME_DESCRIPTOR_FILENAME);

export const readAuthServiceRuntimeDescriptor = (dataDir: string): AuthServiceRuntimeDescriptor | null => {
  const filePath = resolveAuthServiceRuntimeDescriptorPath(dataDir);
  try {
    return normalizeAuthServiceRuntimeDescriptor(JSON.parse(readFileSync(filePath, "utf8")));
  } catch {
    return null;
  }
};

export const writeAuthServiceRuntimeDescriptor = (descriptor: AuthServiceRuntimeDescriptor): void => {
  const filePath = resolveAuthServiceRuntimeDescriptorPath(descriptor.dataDir);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(descriptor, null, 2)}\n`, "utf8");
};

const sameRuntimeDescriptorOwner = (
  left: Pick<AuthServiceRuntimeDescriptor, "pid" | "endpoint" | "dataDir" | "rootAuthKeyPath">,
  right: Pick<AuthServiceRuntimeDescriptor, "pid" | "endpoint" | "dataDir" | "rootAuthKeyPath">,
): boolean =>
  left.pid === right.pid &&
  left.endpoint === right.endpoint &&
  left.dataDir === right.dataDir &&
  left.rootAuthKeyPath === right.rootAuthKeyPath;

export const clearOwnedAuthServiceRuntimeDescriptor = (
  owner: Pick<AuthServiceRuntimeDescriptor, "pid" | "endpoint" | "dataDir" | "rootAuthKeyPath">,
): void => {
  const current = readAuthServiceRuntimeDescriptor(owner.dataDir);
  if (!current || !sameRuntimeDescriptorOwner(current, owner)) {
    return;
  }
  try {
    unlinkSync(resolveAuthServiceRuntimeDescriptorPath(owner.dataDir));
  } catch {
    // Best effort only. Stale descriptors are ignored unless health checks pass.
  }
};

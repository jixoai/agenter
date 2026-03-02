import { readFile } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";

import type { ResolvedSecurityOptions, RuntimeIO, SecurityOptions } from "./types";

const DEFAULT_PROTOCOLS: Array<"http" | "https"> = ["https"];

const normalizeHostRule = (rule: string): string => rule.trim().toLowerCase();

const hostAllowed = (hostname: string, rules: string[]): boolean => {
  if (rules.length === 0) {
    return false;
  }
  const target = hostname.toLowerCase();
  for (const rawRule of rules) {
    const rule = normalizeHostRule(rawRule);
    if (rule === "*") {
      return true;
    }
    if (rule.startsWith("*.")) {
      const suffix = rule.slice(1);
      if (target.endsWith(suffix)) {
        return true;
      }
      continue;
    }
    if (target === rule) {
      return true;
    }
  }
  return false;
};

const withinDir = (filePath: string, dirPath: string): boolean => {
  if (filePath === dirPath) {
    return true;
  }
  return filePath.startsWith(`${dirPath}${sep}`);
};

const normalizeAbsoluteDir = (pathLike: string): string => resolve(pathLike);

const normalizeFilePath = (pathLike: string, cwd: string): string => {
  if (pathLike.startsWith("file://")) {
    return resolve(new URL(pathLike).pathname);
  }
  return isAbsolute(pathLike) ? resolve(pathLike) : resolve(cwd, pathLike);
};

const resolveSecurity = (options: SecurityOptions | undefined): ResolvedSecurityOptions => {
  return {
    allowFileDirs: (options?.allowFileDirs ?? []).map(normalizeAbsoluteDir),
    allowNetHosts: (options?.allowNetHosts ?? []).map(normalizeHostRule),
    allowNetProtocols: options?.allowNetProtocols ?? DEFAULT_PROTOCOLS,
  };
};

export class ResourceAccess {
  public readonly security: ResolvedSecurityOptions;

  constructor(
    private readonly cwd: string,
    security: SecurityOptions | undefined,
    private readonly io: RuntimeIO | undefined,
  ) {
    this.security = resolveSecurity(security);
  }

  async readFileText(pathLike: string): Promise<string> {
    const absolutePath = normalizeFilePath(pathLike, this.cwd);
    const allowed = this.security.allowFileDirs.some((allowedDir) => withinDir(absolutePath, allowedDir));
    if (!allowed) {
      throw new Error(`mdx2md security blocked file access: ${absolutePath}`);
    }
    if (this.io?.readFileText) {
      return this.io.readFileText(absolutePath);
    }
    return readFile(absolutePath, "utf8");
  }

  async fetchText(urlLike: string): Promise<string> {
    const url = new URL(urlLike);
    const protocol = url.protocol.replace(":", "") as "http" | "https";
    if (!this.security.allowNetProtocols.includes(protocol)) {
      throw new Error(`mdx2md security blocked protocol: ${url.protocol}`);
    }
    if (!hostAllowed(url.hostname, this.security.allowNetHosts)) {
      throw new Error(`mdx2md security blocked host: ${url.hostname}`);
    }

    if (this.io?.fetchText) {
      return this.io.fetchText(url.toString());
    }
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`mdx2md fetch failed (${response.status})`);
    }
    return response.text();
  }
}

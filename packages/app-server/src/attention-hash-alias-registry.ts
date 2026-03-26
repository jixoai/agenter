import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";

const HASH_ALIAS_VERSION = 1 as const;
const DEFAULT_TOKEN_LENGTH = 6;

export interface AttentionHashAliasRecord {
  token: string;
  digest: string;
}

export interface AttentionHashAliasSnapshot {
  version: typeof HASH_ALIAS_VERSION;
  aliases: AttentionHashAliasRecord[];
}

const DEFAULT_HASH_ALIAS_SNAPSHOT: AttentionHashAliasSnapshot = {
  version: HASH_ALIAS_VERSION,
  aliases: [],
};

const isAttentionHashAliasSnapshot = (value: unknown): value is AttentionHashAliasSnapshot => {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === HASH_ALIAS_VERSION &&
    "aliases" in value &&
    Array.isArray(value.aliases)
  );
};

const normalizeDigest = (value: string): string => value.trim().toLowerCase();

const buildDigest = (seed: string): string => createHash("sha256").update(seed).digest("hex");

export class AttentionHashAliasRegistry {
  private readonly digestByToken = new Map<string, string>();
  private readonly tokenByDigest = new Map<string, string>();

  constructor(snapshot?: AttentionHashAliasSnapshot | null) {
    for (const alias of snapshot?.aliases ?? []) {
      const digest = normalizeDigest(alias.digest);
      const token = alias.token.trim().toLowerCase();
      if (!digest || !token) {
        continue;
      }
      this.digestByToken.set(token, digest);
      this.tokenByDigest.set(digest, token);
    }
  }

  ensureTokenForSeed(seed: string): string {
    return this.ensureTokenForDigest(buildDigest(seed));
  }

  ensureTokenForDigest(digestInput: string): string {
    const digest = normalizeDigest(digestInput);
    const existing = this.tokenByDigest.get(digest);
    if (existing) {
      return existing;
    }

    let length = DEFAULT_TOKEN_LENGTH;
    while (length <= digest.length) {
      const token = digest.slice(0, length);
      const currentDigest = this.digestByToken.get(token);
      if (!currentDigest || currentDigest === digest) {
        this.digestByToken.set(token, digest);
        this.tokenByDigest.set(digest, token);
        return token;
      }
      length += 1;
    }

    this.digestByToken.set(digest, digest);
    this.tokenByDigest.set(digest, digest);
    return digest;
  }

  snapshot(): AttentionHashAliasSnapshot {
    return {
      version: HASH_ALIAS_VERSION,
      aliases: [...this.tokenByDigest.entries()]
        .map(([digest, token]) => ({ token, digest }))
        .sort((left, right) => left.token.localeCompare(right.token)),
    };
  }
}

export class AttentionHashAliasStore {
  private writeQueue = Promise.resolve();

  constructor(private readonly rootDir: string) {}

  getStatePath(): string {
    return join(this.rootDir, "hash-aliases.json");
  }

  async load(): Promise<AttentionHashAliasSnapshot> {
    try {
      const parsed = JSON.parse(await readFile(this.getStatePath(), "utf8")) as unknown;
      if (isAttentionHashAliasSnapshot(parsed)) {
        return parsed;
      }
      return DEFAULT_HASH_ALIAS_SNAPSHOT;
    } catch {
      return DEFAULT_HASH_ALIAS_SNAPSHOT;
    }
  }

  async save(snapshot: AttentionHashAliasSnapshot): Promise<void> {
    const payload = JSON.stringify(snapshot, null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(this.rootDir, { recursive: true });
      const statePath = this.getStatePath();
      const tempPath = `${statePath}.${Date.now()}-${Math.random().toString(36).slice(2, 8)}.tmp`;
      await writeFile(tempPath, payload, "utf8");
      await rename(tempPath, statePath);
    });
    await this.writeQueue;
  }
}

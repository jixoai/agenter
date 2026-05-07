import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  productDelegationCreateInputSchema,
  productDelegationLookupSchema,
  productDelegationRecordSchema,
  productDelegationRevokeInputSchema,
  type ProductDelegationCreateInput,
  type ProductDelegationLookup,
  type ProductDelegationRecord,
  type ProductDelegationRevokeInput,
} from "@agenter/product-extension-runtime";

interface ProductDelegationDocument {
  version: 1;
  updatedAt: string;
  records: ProductDelegationRecord[];
}

const CURRENT_VERSION = 1 as const;

const nowIso = (): string => new Date().toISOString();

const createEmptyDocument = (): ProductDelegationDocument => ({
  version: CURRENT_VERSION,
  updatedAt: nowIso(),
  records: [],
});

const cloneRecord = (record: ProductDelegationRecord): ProductDelegationRecord =>
  productDelegationRecordSchema.parse(structuredClone(record));

const normalizeDocument = (input: unknown): ProductDelegationDocument => {
  if (!input || typeof input !== "object") {
    return createEmptyDocument();
  }
  const raw = input as {
    updatedAt?: unknown;
    records?: unknown;
  };
  const records = Array.isArray(raw.records)
    ? raw.records.flatMap((value) => {
        const parsed = productDelegationRecordSchema.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  return {
    version: CURRENT_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : nowIso(),
    records,
  };
};

const sortRecords = (records: ProductDelegationRecord[]): ProductDelegationRecord[] =>
  [...records].sort((left, right) => {
    if (left.enabledAt !== right.enabledAt) {
      return right.enabledAt - left.enabledAt;
    }
    return right.delegationId.localeCompare(left.delegationId);
  });

export interface ProductExtensionDelegationStoreOptions {
  filePath: string;
}

export class ProductExtensionDelegationStore {
  private readonly filePath: string;
  private doc: ProductDelegationDocument;

  constructor(options: ProductExtensionDelegationStoreOptions) {
    this.filePath = resolve(options.filePath);
    this.doc = this.readFromDisk();
  }

  list(input: ProductDelegationLookup): ProductDelegationRecord[] {
    const lookup = productDelegationLookupSchema.parse(input);
    this.doc = this.readFromDisk();
    const now = Date.now();
    const normalized = this.applyExpiry(this.doc.records, now);
    if (normalized.changed) {
      this.replace(normalized.records);
    }
    return sortRecords(normalized.records)
      .filter((record) => record.productId === lookup.productId)
      .filter((record) => (lookup.resourceKey ? record.resourceKey === lookup.resourceKey : true))
      .filter((record) => (lookup.runtimeId ? record.runtimeId === lookup.runtimeId : true))
      .filter((record) => (lookup.avatarActorId ? record.avatarActorId === lookup.avatarActorId : true))
      .filter((record) => (lookup.includeRevoked ? true : record.status === "active"))
      .map(cloneRecord);
  }

  create(input: ProductDelegationCreateInput): ProductDelegationRecord {
    const parsed = productDelegationCreateInputSchema.parse(input);
    const next = productDelegationRecordSchema.parse({
      ...parsed,
      delegationId: this.createDelegationId(parsed),
      status: parsed.expiresAt <= Date.now() ? "expired" : "active",
    });
    const records = this.readFromDisk().records;
    this.replace(records.filter((record) => record.delegationId !== next.delegationId).concat(next));
    return cloneRecord(next);
  }

  revoke(input: ProductDelegationRevokeInput): ProductDelegationRecord {
    const parsed = productDelegationRevokeInputSchema.parse(input);
    const current = this.readFromDisk();
    const target = current.records.find((record) => record.delegationId === parsed.delegationId);
    if (!target) {
      throw new Error(`unknown product delegation: ${parsed.delegationId}`);
    }
    const next = productDelegationRecordSchema.parse({
      ...target,
      status: "revoked",
      revokedAt: parsed.revokedAt,
      revokedReason: parsed.revokedReason,
    });
    this.replace(current.records.map((record) => (record.delegationId === next.delegationId ? next : record)));
    return cloneRecord(next);
  }

  private createDelegationId(input: ProductDelegationCreateInput): string {
    return [
      input.productId,
      input.resourceKey,
      String(input.enabledAt),
      Math.random().toString(36).slice(2, 10),
    ].join(":");
  }

  private applyExpiry(
    records: ProductDelegationRecord[],
    now: number,
  ): { changed: boolean; records: ProductDelegationRecord[] } {
    let changed = false;
    const next = records.map((record) => {
      if (record.status === "active" && record.expiresAt <= now) {
        changed = true;
        return productDelegationRecordSchema.parse({
          ...record,
          status: "expired",
        });
      }
      return productDelegationRecordSchema.parse(record);
    });
    return {
      changed,
      records: next,
    };
  }

  private readFromDisk(): ProductDelegationDocument {
    if (!existsSync(this.filePath)) {
      return createEmptyDocument();
    }
    try {
      return normalizeDocument(JSON.parse(readFileSync(this.filePath, "utf8")) as unknown);
    } catch {
      return createEmptyDocument();
    }
  }

  private replace(records: ProductDelegationRecord[]): void {
    this.doc = {
      version: CURRENT_VERSION,
      updatedAt: nowIso(),
      records: sortRecords(records).map(cloneRecord),
    };
    this.flushAtomic(this.doc);
  }

  private flushAtomic(doc: ProductDelegationDocument): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.filePath);
  }
}

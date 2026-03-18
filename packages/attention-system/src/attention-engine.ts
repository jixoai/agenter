import type {
  AttentionAddInput,
  AttentionQueryInput,
  AttentionRecord,
  AttentionRemarkInput,
  AttentionReplyInput,
  AttentionReplyResult,
  AttentionSystemSnapshot,
} from "./attention-types";

const MAX_SCORE = 100;
const MIN_SCORE = 0;

const nowIso = (): string => new Date().toISOString();

const normalizeScore = (score: number | undefined, fallback: number): number => {
  if (score === undefined) {
    return fallback;
  }
  const integer = Math.trunc(score);
  if (!Number.isFinite(integer)) {
    return fallback;
  }
  if (integer < MIN_SCORE) {
    return MIN_SCORE;
  }
  if (integer > MAX_SCORE) {
    return MAX_SCORE;
  }
  return integer;
};

const contains = (haystack: string, needle: string): boolean => haystack.toLowerCase().includes(needle.toLowerCase());

export class AttentionEngine {
  private readonly records = new Map<number, AttentionRecord>();
  private nextId = 1;

  constructor(snapshot?: AttentionSystemSnapshot) {
    if (!snapshot) {
      return;
    }
    this.nextId = Math.max(1, Math.trunc(snapshot.nextId) || 1);
    for (const record of snapshot.records) {
      this.records.set(record.id, { ...record });
      if (record.id >= this.nextId) {
        this.nextId = record.id + 1;
      }
    }
  }

  list(): AttentionRecord[] {
    return this.sorted().filter((record) => record.score > 0);
  }

  all(): AttentionRecord[] {
    return this.sorted();
  }

  query(input: AttentionQueryInput = {}): AttentionRecord[] {
    const offset = Math.max(0, Math.trunc(input.offset ?? 0));
    const limit = Math.max(1, Math.trunc(input.limit ?? 20));
    const query = input.query?.trim();
    const includeInactive = input.includeInactive ?? true;

    const filtered = this.sorted().filter((record) => {
      if (!includeInactive && record.score <= 0) {
        return false;
      }
      if (!query) {
        return true;
      }
      return contains(record.content, query) || contains(record.from, query) || contains(record.remark, query);
    });

    return filtered.slice(offset, offset + limit);
  }

  add(input: AttentionAddInput): AttentionRecord {
    const content = input.content.trim();
    if (content.length === 0) {
      throw new Error("attention content is required");
    }
    const from = input.from.trim();
    if (from.length === 0) {
      throw new Error("attention from is required");
    }

    const timestamp = nowIso();
    const record: AttentionRecord = {
      id: this.nextId,
      content,
      from,
      score: normalizeScore(input.score, 100),
      remark: input.remark?.trim() ?? "",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.records.set(record.id, record);
    this.nextId += 1;
    return { ...record };
  }

  remark(input: AttentionRemarkInput): AttentionRecord | undefined {
    const record = this.records.get(input.id);
    if (!record) {
      return undefined;
    }

    const next: AttentionRecord = {
      ...record,
      score: normalizeScore(input.score, record.score),
      remark: input.remark !== undefined ? input.remark.trim() : record.remark,
      updatedAt: nowIso(),
    };
    this.records.set(next.id, next);
    return { ...next };
  }

  reply(input: AttentionReplyInput): AttentionReplyResult {
    const reply = this.add({
      content: input.replyContent,
      from: input.from?.trim() || "assistant",
      score: input.score ?? 0,
    });

    const related: AttentionRecord[] = [];
    for (const relation of input.relationships ?? []) {
      const updated = this.remark({
        id: relation.id,
        score: relation.score,
        remark: relation.remark,
      });
      if (updated) {
        related.push(updated);
      }
    }

    return { reply, related };
  }

  snapshot(): AttentionSystemSnapshot {
    return {
      nextId: this.nextId,
      records: this.sorted(),
    };
  }

  private sorted(): AttentionRecord[] {
    return [...this.records.values()].sort((a, b) => a.id - b.id);
  }
}

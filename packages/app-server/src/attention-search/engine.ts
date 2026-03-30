import { AttentionSystem, type AttentionCommitMatch } from "@agenter/attention-system";

import { buildAttentionSearchDocument, toAttentionCommitKey } from "./documents";
import { AttentionSearchIndexStore } from "./index-store";
import { compileAttentionSearch } from "./query";
import type { AttentionSearchRequest } from "./types";

export class AttentionSearchEngine {
  private readonly indexStore: AttentionSearchIndexStore;

  constructor(dbPath: string) {
    this.indexStore = new AttentionSearchIndexStore(dbPath);
  }

  async sync(snapshot: ReturnType<AttentionSystem["snapshot"]>): Promise<void> {
    const attentionSystem = AttentionSystem.fromSnapshot(snapshot);
    await this.indexStore.ensureSnapshot(attentionSystem.query({ minScore: 0, limit: Number.MAX_SAFE_INTEGER }));
  }

  async query(input: {
    attentionSystem: AttentionSystem;
    snapshot: ReturnType<AttentionSystem["snapshot"]>;
    request: AttentionSearchRequest;
  }): Promise<AttentionCommitMatch[]> {
    const offset = Math.max(0, Math.trunc(input.request.offset ?? 0));
    const limit = Math.max(1, Math.trunc(input.request.limit ?? 120));
    const normalizedQuery = input.request.query?.trim() ?? "";

    if (normalizedQuery.length === 0) {
      return input.attentionSystem.query({ minScore: 1, offset, limit });
    }

    const compiled = compileAttentionSearch(normalizedQuery);
    const effectiveMinScore =
      compiled.controls.minScore ?? (compiled.controls.hash ? 0 : 1);
    const baseMatches = input.attentionSystem.query({
      contextId: compiled.controls.contextId,
      hash: compiled.controls.hash,
      depth: compiled.controls.depth,
      author: compiled.controls.author,
      source: compiled.controls.source,
      minScore: effectiveMinScore,
      limit: Number.MAX_SAFE_INTEGER,
    });

    let candidateKeys: Set<string> | null = null;
    if (compiled.useFts && compiled.seeds.length > 0) {
      await this.sync(input.snapshot);
      candidateKeys = await this.indexStore.queryCandidates(compiled.seeds);
    }

    const filtered = baseMatches.filter((match) => {
      if (candidateKeys && candidateKeys.size > 0 && !candidateKeys.has(toAttentionCommitKey(match.contextId, match.commit.commitId))) {
        return false;
      }
      return compiled.evaluate(buildAttentionSearchDocument(match));
    });
    return filtered.slice(offset, offset + limit);
  }
}

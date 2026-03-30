import { DuckDBInstance } from "@duckdb/node-api";
import type { AttentionCommitMatch } from "@agenter/attention-system";
import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";

import { buildAttentionSearchDocuments } from "./documents";
import type { AttentionSearchSeed } from "./types";

const buildSnapshotHash = (matches: readonly AttentionCommitMatch[]): string =>
  createHash("sha256").update(JSON.stringify(matches)).digest("hex");

const FTS_FIELDS = {
  summary: "summary",
  change: "change_value",
  text: "search_text",
} as const;

export class AttentionSearchIndexStore {
  private ftsAvailable = true;

  constructor(private readonly dbPath: string) {}

  async ensureSnapshot(matches: readonly AttentionCommitMatch[]): Promise<void> {
    if (!this.ftsAvailable) {
      return;
    }
    const snapshotHash = buildSnapshotHash(matches);
    const currentHash = await this.readSnapshotHash();
    if (currentHash === snapshotHash) {
      return;
    }
    try {
      await rm(this.dbPath, { force: true });
      await mkdir(dirname(this.dbPath), { recursive: true });
      const instance = await DuckDBInstance.create(this.dbPath);
      const connection = await instance.connect();
      try {
        await connection.run("INSTALL fts;");
        await connection.run("LOAD fts;");
        await connection.run(`
          create table attention_commit_search (
            commit_key varchar primary key,
            context_id varchar not null,
            commit_id varchar not null,
            author varchar not null,
            source varchar not null,
            summary varchar not null,
            change_type varchar not null,
            change_value varchar not null,
            meta_json varchar not null,
            search_text varchar not null,
            created_at_ms bigint not null,
            updated_at_ms bigint not null,
            unresolved_score_count integer not null,
            max_active_score integer not null
          );
          create table attention_search_meta (
            key varchar primary key,
            value varchar not null
          );
        `);
        const documents = buildAttentionSearchDocuments(matches);
        for (const doc of documents) {
          await connection.run(
            `insert into attention_commit_search (
               commit_key, context_id, commit_id, author, source, summary, change_type, change_value,
               meta_json, search_text, created_at_ms, updated_at_ms, unresolved_score_count, max_active_score
             ) values (
               $commitKey, $contextId, $commitId, $author, $source, $summary, $changeType, $changeValue,
               $metaJson, $searchText, $createdAtMs, $updatedAtMs, $unresolvedScoreCount, $maxActiveScore
             )`,
            {
              commitKey: doc.commitKey,
              contextId: doc.contextId,
              commitId: doc.commitId,
              author: doc.author,
              source: doc.source,
              summary: doc.summary,
              changeType: doc.changeType,
              changeValue: doc.changeValue,
              metaJson: doc.metaJson,
              searchText: doc.searchText,
              createdAtMs: doc.createdAtMs,
              updatedAtMs: doc.updatedAtMs,
              unresolvedScoreCount: doc.unresolvedScoreCount,
              maxActiveScore: doc.maxActiveScore,
            },
          );
        }
        await connection.run(
          `insert into attention_search_meta(key, value) values ('snapshot_hash', $snapshotHash)`,
          { snapshotHash },
        );
        await connection.run(
          `PRAGMA create_fts_index('attention_commit_search', 'commit_key', 'summary', 'change_value', 'meta_json', 'search_text');`,
        );
      } finally {
        connection.closeSync();
        instance.closeSync();
      }
    } catch {
      this.ftsAvailable = false;
      await rm(this.dbPath, { force: true });
    }
  }

  async queryCandidates(seeds: readonly AttentionSearchSeed[]): Promise<Set<string> | null> {
    if (!this.ftsAvailable || seeds.length === 0) {
      return null;
    }
    try {
      const instance = await DuckDBInstance.create(this.dbPath);
      const connection = await instance.connect();
      try {
        await connection.run("LOAD fts;");
        const matches = new Set<string>();
        for (const seed of seeds) {
          const fieldSql =
            seed.field === "summary" || seed.field === "change" || seed.field === "text"
              ? `, fields := '${FTS_FIELDS[seed.field]}'`
              : "";
          const reader = await connection.runAndReadAll(
            `select commit_key
               from (
                 select commit_key,
                        fts_main_attention_commit_search.match_bm25(commit_key, $query${fieldSql}) as score
                 from attention_commit_search
               ) ranked
              where score is not null`,
            { query: seed.value.replaceAll("*", "") },
          );
          for (const row of reader.getRowObjectsJS() as Array<Record<string, unknown>>) {
            if (typeof row.commit_key === "string") {
              matches.add(row.commit_key);
            }
          }
        }
        return matches;
      } finally {
        connection.closeSync();
        instance.closeSync();
      }
    } catch {
      this.ftsAvailable = false;
      return null;
    }
  }

  private async readSnapshotHash(): Promise<string | null> {
    try {
      const instance = await DuckDBInstance.create(this.dbPath);
      const connection = await instance.connect();
      try {
        const reader = await connection.runAndReadAll(
          `select value from attention_search_meta where key = 'snapshot_hash' limit 1`,
        );
        const rows = reader.getRowObjectsJS() as Array<Record<string, unknown>>;
        return rows[0] && typeof rows[0].value === "string" ? rows[0].value : null;
      } finally {
        connection.closeSync();
        instance.closeSync();
      }
    } catch {
      return null;
    }
  }
}

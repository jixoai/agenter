import { Database } from "bun:sqlite";
import type { AttentionCommitMatch } from "@agenter/attention-system";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { buildAttentionSearchDocuments } from "./documents";
import type { AttentionSearchSeed } from "./types";

const buildSnapshotHash = (matches: readonly AttentionCommitMatch[]): string =>
  createHash("sha256").update(JSON.stringify(matches)).digest("hex");

const FTS_FIELDS = {
  summary: "summary",
  change: "change_value",
  text: "search_text",
} as const;

type SnapshotHashRow = {
  value: string;
};

type CandidateRow = {
  commit_key: string;
};

const quoteFtsTerm = (value: string): string => `"${value.replaceAll('"', '""')}"`;

const buildSeedQuery = (seed: AttentionSearchSeed): string | null => {
  const term = seed.value.replaceAll("*", "").trim();
  if (term.length === 0) {
    return null;
  }
  const quoted = quoteFtsTerm(term);
  const column =
    seed.field === "summary" || seed.field === "change" || seed.field === "text" ? FTS_FIELDS[seed.field] : null;
  return column ? `${column}:${quoted}` : quoted;
};

export class AttentionSearchIndexStore {
  private ftsAvailable = true;
  private readonly resolvedDbPath: string;

  constructor(dbPath: string) {
    this.resolvedDbPath = resolve(dbPath);
  }

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
      await rm(this.resolvedDbPath, { force: true });
      mkdirSync(dirname(this.resolvedDbPath), { recursive: true });
      const db = new Database(this.resolvedDbPath, { create: true, strict: true });
      try {
        db.exec(`pragma journal_mode = WAL;`);
        db.exec(`
          create table attention_search_meta (
            key text primary key,
            value text not null
          ) strict;
          create virtual table attention_commit_search using fts5(
            commit_key unindexed,
            summary,
            change_value,
            meta_json,
            search_text,
            tokenize = 'unicode61 remove_diacritics 2'
          );
        `);
        const documents = buildAttentionSearchDocuments(matches);
        const insertDoc = db.query(
          `insert into attention_commit_search (
             commit_key, summary, change_value, meta_json, search_text
           ) values (?, ?, ?, ?, ?)`,
        );
        const writeMeta = db.query(`insert into attention_search_meta(key, value) values ('snapshot_hash', ?)`);

        // The attention search sidecar is rebuildable projection state, so a
        // snapshot hash change replaces the whole SQLite projection in one pass.
        db.exec("begin immediate");
        try {
          for (const doc of documents) {
            insertDoc.run(doc.commitKey, doc.summary, doc.changeValue, doc.metaJson, doc.searchText);
          }
          writeMeta.run(snapshotHash);
          db.exec("commit");
        } catch (error) {
          db.exec("rollback");
          throw error;
        }
      } finally {
        db.close();
      }
    } catch {
      this.ftsAvailable = false;
      await rm(this.resolvedDbPath, { force: true });
    }
  }

  async queryCandidates(seeds: readonly AttentionSearchSeed[]): Promise<Set<string> | null> {
    if (!this.ftsAvailable || seeds.length === 0) {
      return null;
    }
    try {
      const db = new Database(this.resolvedDbPath, { readonly: true, strict: true });
      try {
        const matches = new Set<string>();
        for (const seed of seeds) {
          const ftsQuery = buildSeedQuery(seed);
          if (!ftsQuery) {
            continue;
          }
          const rows = db
            .query(`select commit_key from attention_commit_search where attention_commit_search match ?`)
            .all(ftsQuery) as CandidateRow[];
          for (const row of rows) {
            matches.add(row.commit_key);
          }
        }
        return matches;
      } finally {
        db.close();
      }
    } catch {
      this.ftsAvailable = false;
      return null;
    }
  }

  private async readSnapshotHash(): Promise<string | null> {
    try {
      const db = new Database(this.resolvedDbPath, { readonly: true, strict: true });
      try {
        const row = db.query(`select value from attention_search_meta where key = 'snapshot_hash' limit 1`).get() as
          | SnapshotHashRow
          | null;
        return row?.value ?? null;
      } finally {
        db.close();
      }
    } catch {
      return null;
    }
  }
}

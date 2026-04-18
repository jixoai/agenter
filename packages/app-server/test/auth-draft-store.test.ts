import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";

import { AuthDraftStore } from "../src/auth-draft-store";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createStore = (): AuthDraftStore => {
  const root = mkdtempSync(join(tmpdir(), "agenter-auth-draft-"));
  tempRoots.push(root);
  return new AuthDraftStore(join(root, "auth-drafts.db"));
};

describe("Feature: auth-scoped draft store", () => {
  test("Scenario: Given two auth actors When both create avatar drafts Then list and replay stay isolated per actor", () => {
    const store = createStore();
    try {
      const actorADraft = store.create("auth-a", {
        kind: "avatar_create",
        state: {
          nickname: "reviewer",
          sourceAvatarNickname: "default",
        },
      });
      const actorBDraft = store.create("auth-b", {
        kind: "avatar_create",
        state: {
          nickname: "operator",
          sourceAvatarNickname: "",
        },
      });

      const actorAList = store.list("auth-a");
      const actorBList = store.list("auth-b");

      expect(actorAList).toEqual({
        lastEventId: actorADraft.eventId,
        items: [actorADraft.entry],
      });
      expect(actorBList).toEqual({
        lastEventId: actorBDraft.eventId,
        items: [actorBDraft.entry],
      });

      expect(store.getEventsAfter("auth-a", 0)).toEqual([
        {
          eventId: actorADraft.eventId,
          timestamp: actorADraft.entry.updatedAt,
          kind: "upsert",
          entry: actorADraft.entry,
        },
      ]);
      expect(store.getEventsAfter("auth-b", 0)).toEqual([
        {
          eventId: actorBDraft.eventId,
          timestamp: actorBDraft.entry.updatedAt,
          kind: "upsert",
          entry: actorBDraft.entry,
        },
      ]);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given optimistic draft saves When versions drift or a draft disappears Then the store reports conflicts and idempotent deletes correctly", () => {
    const store = createStore();
    try {
      const created = store.create("auth-a", {
        kind: "avatar_create",
        state: {
          nickname: "reviewer",
          sourceAvatarNickname: "default",
        },
      });

      const idempotent = store.save("auth-a", {
        draftId: created.entry.draftId,
        kind: "avatar_create",
        state: {
          nickname: "reviewer",
          sourceAvatarNickname: "default",
        },
        baseVersion: created.entry.version,
      });
      expect(idempotent).toMatchObject({
        ok: true,
        changed: false,
        eventId: null,
        entry: {
          draftId: created.entry.draftId,
          version: 1,
        },
      });

      const saved = store.save("auth-a", {
        draftId: created.entry.draftId,
        kind: "avatar_create",
        state: {
          nickname: "reviewer-2",
          sourceAvatarNickname: "default",
        },
        baseVersion: created.entry.version,
      });
      expect(saved).toMatchObject({
        ok: true,
        changed: true,
        eventId: 2,
        entry: {
          draftId: created.entry.draftId,
          kind: "avatar_create",
          version: 2,
          state: {
            nickname: "reviewer-2",
            sourceAvatarNickname: "default",
          },
        },
      });

      const conflict = store.save("auth-a", {
        draftId: created.entry.draftId,
        kind: "avatar_create",
        state: {
          nickname: "reviewer-3",
          sourceAvatarNickname: "default",
        },
        baseVersion: 1,
      });
      expect(conflict).toMatchObject({
        ok: false,
        reason: "conflict",
        latest: {
          draftId: created.entry.draftId,
          version: 2,
        },
      });

      const removed = store.delete("auth-a", {
        draftId: created.entry.draftId,
        baseVersion: 2,
      });
      expect(removed).toEqual({
        ok: true,
        removed: true,
        eventId: 3,
        draftId: created.entry.draftId,
        kind: "avatar_create",
        version: 3,
      });

      const noopDelete = store.delete("auth-a", {
        draftId: created.entry.draftId,
      });
      expect(noopDelete).toEqual({
        ok: true,
        removed: false,
        eventId: null,
        draftId: created.entry.draftId,
        kind: null,
        version: null,
      });

      const missing = store.save("auth-a", {
        draftId: created.entry.draftId,
        kind: "avatar_create",
        state: {
          nickname: "missing",
          sourceAvatarNickname: "",
        },
      });
      expect(missing).toEqual({
        ok: false,
        reason: "not_found",
        latest: null,
      });
    } finally {
      store.close();
    }
  });

  test("Scenario: Given a kind-filtered subscriber When unrelated draft ids change Then replay and live events stay scoped to the requested draft kind", () => {
    const store = createStore();
    try {
      const seen: Array<{ authId: string; kind: string; draftId: string }> = [];
      const unsubscribe = store.onEvent((event) => {
        seen.push({
          authId: event.authId,
          kind: event.kind,
          draftId: event.kind === "upsert" ? event.entry.draftId : event.draftId,
        });
      });

      const created = store.create("auth-a", {
        kind: "avatar_create",
        state: {
          nickname: "reviewer",
          sourceAvatarNickname: "",
        },
      });
      store.save("auth-a", {
        draftId: created.entry.draftId,
        kind: "avatar_create",
        state: {
          nickname: "reviewer-2",
          sourceAvatarNickname: "default",
        },
        baseVersion: created.entry.version,
      });
      store.delete("auth-a", {
        draftId: created.entry.draftId,
        baseVersion: 2,
      });
      unsubscribe();

      expect(
        store.getEventsAfter("auth-a", 0, {
          kind: "avatar_create",
        }),
      ).toEqual([
        {
          eventId: 1,
          timestamp: expect.any(Number),
          kind: "upsert",
          entry: {
            draftId: created.entry.draftId,
            kind: "avatar_create",
            state: {
              nickname: "reviewer",
              sourceAvatarNickname: "",
            },
            version: 1,
            createdAt: expect.any(Number),
            updatedAt: expect.any(Number),
          },
        },
        {
          eventId: 2,
          timestamp: expect.any(Number),
          kind: "upsert",
          entry: {
            draftId: created.entry.draftId,
            kind: "avatar_create",
            state: {
              nickname: "reviewer-2",
              sourceAvatarNickname: "default",
            },
            version: 2,
            createdAt: expect.any(Number),
            updatedAt: expect.any(Number),
          },
        },
        {
          eventId: 3,
          timestamp: expect.any(Number),
          kind: "delete",
          draftId: created.entry.draftId,
          draftKind: "avatar_create",
          version: 3,
        },
      ]);
      expect(seen).toEqual([
        { authId: "auth-a", kind: "upsert", draftId: created.entry.draftId },
        { authId: "auth-a", kind: "upsert", draftId: created.entry.draftId },
        { authId: "auth-a", kind: "delete", draftId: created.entry.draftId },
      ]);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given a version-1 draft database When the store opens it Then migration backfills created-at facts and new writes keep working", () => {
    const root = mkdtempSync(join(tmpdir(), "agenter-auth-draft-legacy-"));
    tempRoots.push(root);
    const dbPath = join(root, "auth-drafts.db");
    const createdAt = 1_712_345_678_900;
    const updatedAt = createdAt + 45;
    const legacyDraftId = "11111111-1111-4111-8111-111111111111";
    const legacyState = JSON.stringify({
      nickname: "reviewer",
      sourceAvatarNickname: "default",
    });
    const db = new Database(dbPath, { create: true, strict: true });
    try {
      db.exec("create table auth_draft_meta (schema_version integer not null) strict");
      db.query("insert into auth_draft_meta (schema_version) values (1)").run();
      db.exec(`
        create table auth_draft_entry (
          auth_id text not null,
          draft_id text not null,
          kind text not null,
          state_json text not null,
          version integer not null,
          created_at integer not null,
          updated_at integer not null,
          primary key (auth_id, draft_id)
        ) strict
      `);
      db.exec(`
        create table auth_draft_event (
          event_id integer primary key autoincrement,
          auth_id text not null,
          draft_id text not null,
          kind text not null,
          op text not null,
          state_json text,
          version integer not null,
          created_at integer not null
        ) strict
      `);
      db.query(
        `insert into auth_draft_entry (auth_id, draft_id, kind, state_json, version, created_at, updated_at)
         values (?, ?, 'avatar_create', ?, 1, ?, ?)`,
      ).run("auth-a", legacyDraftId, legacyState, createdAt, updatedAt);
      db.query(
        `insert into auth_draft_event (auth_id, draft_id, kind, op, state_json, version, created_at)
         values (?, ?, 'avatar_create', 'upsert', ?, 1, ?)`,
      ).run("auth-a", legacyDraftId, legacyState, updatedAt);
    } finally {
      db.close();
    }

    const store = new AuthDraftStore(dbPath);
    try {
      expect(store.getEventsAfter("auth-a", 0)).toEqual([
        {
          eventId: 1,
          timestamp: updatedAt,
          kind: "upsert",
          entry: {
            draftId: legacyDraftId,
            kind: "avatar_create",
            state: {
              nickname: "reviewer",
              sourceAvatarNickname: "default",
            },
            version: 1,
            createdAt,
            updatedAt,
          },
        },
      ]);

      const saved = store.save("auth-a", {
        draftId: legacyDraftId,
        kind: "avatar_create",
        state: {
          nickname: "reviewer-2",
          sourceAvatarNickname: "default",
        },
        baseVersion: 1,
      });
      expect(saved).toMatchObject({
        ok: true,
        changed: true,
        eventId: 2,
        entry: {
          draftId: legacyDraftId,
          kind: "avatar_create",
          version: 2,
          createdAt,
          state: {
            nickname: "reviewer-2",
            sourceAvatarNickname: "default",
          },
        },
      });

      expect(store.getEventsAfter("auth-a", 1)).toEqual([
        {
          eventId: 2,
          timestamp: expect.any(Number),
          kind: "upsert",
          entry: {
            draftId: legacyDraftId,
            kind: "avatar_create",
            state: {
              nickname: "reviewer-2",
              sourceAvatarNickname: "default",
            },
            version: 2,
            createdAt,
            updatedAt: expect.any(Number),
          },
        },
      ]);
    } finally {
      store.close();
    }
  });
});

import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { AuthKvStore } from "../src/auth-kv-store";

const tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const createStore = (): AuthKvStore => {
  const root = mkdtempSync(join(tmpdir(), "agenter-auth-kv-"));
  tempRoots.push(root);
  return new AuthKvStore(join(root, "auth-kv.db"));
};

describe("Feature: auth-scoped kv store", () => {
  test("Scenario: Given two auth actors When both persist the same key Then snapshot and replay stay isolated per actor", () => {
    const store = createStore();
    try {
      store.set("auth-a", { key: "webui/devtools/tab", value: "model" });
      store.set("auth-b", { key: "webui/devtools/tab", value: "cycles" });

      const actorASnapshot = store.snapshot("auth-a");
      const actorBSnapshot = store.snapshot("auth-b");

      expect(actorASnapshot.lastEventId).toBe(1);
      expect(actorASnapshot.items).toEqual([
        {
          key: "webui/devtools/tab",
          value: "model",
          version: 1,
          updatedAt: actorASnapshot.items[0]?.updatedAt ?? 0,
        },
      ]);
      expect(actorBSnapshot.lastEventId).toBe(2);
      expect(actorBSnapshot.items).toEqual([
        {
          key: "webui/devtools/tab",
          value: "cycles",
          version: 1,
          updatedAt: actorBSnapshot.items[0]?.updatedAt ?? 0,
        },
      ]);

      expect(store.getEventsAfter("auth-a", 0)).toEqual([
        {
          eventId: 1,
          timestamp: actorASnapshot.items[0]?.updatedAt ?? 0,
          kind: "set",
          entry: actorASnapshot.items[0]!,
        },
      ]);
      expect(store.getEventsAfter("auth-b", 0)).toEqual([
        {
          eventId: 2,
          timestamp: actorBSnapshot.items[0]?.updatedAt ?? 0,
          kind: "set",
          entry: actorBSnapshot.items[0]!,
        },
      ]);
    } finally {
      store.close();
    }
  });

  test("Scenario: Given optimistic writes and deletes When versions drift or values are unchanged Then the store reports conflicts without emitting duplicate events", () => {
    const store = createStore();
    try {
      const first = store.set("auth-a", {
        key: "webui/runtime/toggle",
        value: { enabled: true, order: ["a", "b"] },
      });
      expect(first).toMatchObject({
        ok: true,
        changed: true,
        eventId: 1,
        entry: {
          key: "webui/runtime/toggle",
          value: { enabled: true, order: ["a", "b"] },
          version: 1,
        },
      });

      const idempotent = store.set("auth-a", {
        key: "webui/runtime/toggle",
        value: { order: ["a", "b"], enabled: true },
      });
      expect(idempotent).toMatchObject({
        ok: true,
        changed: false,
        eventId: null,
        entry: {
          key: "webui/runtime/toggle",
          version: 1,
        },
      });

      const createConflict = store.set("auth-a", {
        key: "webui/runtime/toggle",
        value: false,
        baseVersion: null,
      });
      expect(createConflict).toMatchObject({
        ok: false,
        reason: "conflict",
        latest: {
          key: "webui/runtime/toggle",
          version: 1,
        },
      });

      const second = store.set("auth-a", {
        key: "webui/runtime/toggle",
        value: { enabled: false },
        baseVersion: 1,
      });
      expect(second).toMatchObject({
        ok: true,
        changed: true,
        eventId: 2,
        entry: {
          key: "webui/runtime/toggle",
          value: { enabled: false },
          version: 2,
        },
      });

      const deleteConflict = store.delete("auth-a", {
        key: "webui/runtime/toggle",
        baseVersion: 1,
      });
      expect(deleteConflict).toMatchObject({
        ok: false,
        reason: "conflict",
        latest: {
          key: "webui/runtime/toggle",
          version: 2,
        },
      });

      const removed = store.delete("auth-a", {
        key: "webui/runtime/toggle",
        baseVersion: 2,
      });
      expect(removed).toEqual({
        ok: true,
        removed: true,
        eventId: 3,
        key: "webui/runtime/toggle",
        version: 3,
      });

      expect(store.snapshot("auth-a")).toEqual({
        lastEventId: 3,
        items: [],
      });

      const recreated = store.set("auth-a", {
        key: "webui/runtime/toggle",
        value: { enabled: "again" },
        baseVersion: null,
      });
      expect(recreated).toMatchObject({
        ok: true,
        changed: true,
        eventId: 4,
        entry: {
          key: "webui/runtime/toggle",
          value: { enabled: "again" },
          version: 4,
        },
      });
    } finally {
      store.close();
    }
  });

  test("Scenario: Given a prefix subscriber When unrelated keys change Then replay and live events stay filtered without rescanning every key manually", () => {
    const store = createStore();
    try {
      const seen: Array<{ authId: string; kind: string; key: string }> = [];
      const unsubscribe = store.onEvent((event) => {
        seen.push({
          authId: event.authId,
          kind: event.kind,
          key: event.kind === "set" ? event.entry.key : event.key,
        });
      });

      store.set("auth-a", { key: "webui/devtools/tab", value: "model" });
      store.set("auth-a", { key: "webui/workspace/split", value: 0.4 });
      store.delete("auth-a", { key: "webui/devtools/tab" });
      unsubscribe();

      expect(
        store.getEventsAfter("auth-a", 0, {
          prefix: "webui/devtools/",
        }),
      ).toEqual([
        {
          eventId: 1,
          timestamp: expect.any(Number),
          kind: "set",
          entry: {
            key: "webui/devtools/tab",
            value: "model",
            version: 1,
            updatedAt: expect.any(Number),
          },
        },
        {
          eventId: 3,
          timestamp: expect.any(Number),
          kind: "delete",
          key: "webui/devtools/tab",
          version: 2,
        },
      ]);
      expect(seen).toEqual([
        { authId: "auth-a", kind: "set", key: "webui/devtools/tab" },
        { authId: "auth-a", kind: "set", key: "webui/workspace/split" },
        { authId: "auth-a", kind: "delete", key: "webui/devtools/tab" },
      ]);
    } finally {
      store.close();
    }
  });
});

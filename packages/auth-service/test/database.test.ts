import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openProfileDatabase } from "../src/store/database";

const createTempDir = (): string => mkdtempSync(join(tmpdir(), "auth-service-database-test-"));

describe("Feature: auth-service sqlite store startup", () => {
  test("Scenario: Given a fresh auth-service store When it opens Then canonical sqlite storage is materialized", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "auth-service.sqlite");

    const database = await openProfileDatabase(dbPath);

    expect(existsSync(dbPath)).toBe(true);

    await database.close();
    expect(existsSync(join(dir, "auth-service.lock.json"))).toBe(false);
  });

  test("Scenario: Given a running auth-service store When a second runtime targets the same path Then startup fails with reuse guidance", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "auth-service.sqlite");
    const database = await openProfileDatabase(dbPath);

    await expect(openProfileDatabase(dbPath)).rejects.toThrow(
      "Reuse the existing auth-service via --auth-service-endpoint",
    );

    await database.close();
  });

  test("Scenario: Given a stale startup lock When auth-service boots Then it recovers the lock and starts", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "auth-service.sqlite");
    const lockPath = join(dir, "auth-service.lock.json");
    writeFileSync(
      lockPath,
      JSON.stringify(
        {
          pid: 999_999,
          command: "bun",
          createdAt: "2026-04-29T00:00:00.000Z",
        },
        null,
        2,
      ),
      "utf8",
    );

    const database = await openProfileDatabase(dbPath);

    expect(existsSync(dbPath)).toBe(true);

    await database.close();
    expect(existsSync(lockPath)).toBe(false);
  });
});

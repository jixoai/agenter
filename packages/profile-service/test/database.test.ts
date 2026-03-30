import type { DuckDBConnection, DuckDBInstance } from "@duckdb/node-api";
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  backupProfileDatabaseWal,
  isRecoverableProfileDatabaseWalError,
  openProfileDatabaseWithDeps,
} from "../src/store/database";

const createTempDir = (): string => mkdtempSync(join(tmpdir(), "profile-database-test-"));

describe("Feature: profile-service duckdb recovery", () => {
  test("Scenario: Given a stale wal file When backup is requested Then the wal is moved aside instead of being deleted", async () => {
    const dir = createTempDir();
    const walPath = join(dir, "profile-service.duckdb.wal");
    writeFileSync(walPath, "stale wal");

    const backupPath = await backupProfileDatabaseWal(walPath);

    expect(backupPath).toBeTruthy();
    expect(existsSync(walPath)).toBe(false);
    expect(backupPath ? existsSync(backupPath) : false).toBe(true);
  });

  test("Scenario: Given duckdb fails on wal replay When the wal is recoverable Then open retries after backing it up", async () => {
    const dir = createTempDir();
    const dbPath = join(dir, "profile-service.duckdb");
    const walPath = `${dbPath}.wal`;
    writeFileSync(walPath, "stale wal");

    let openCount = 0;
    const warnings: string[] = [];
    const fakeConnection = {
      run: async () => undefined,
      closeSync: () => undefined,
    } as unknown as DuckDBConnection;
    const fakeInstance = {
      closeSync: () => undefined,
    } as unknown as DuckDBInstance;

    const database = await openProfileDatabaseWithDeps(dbPath, {
      open: async () => {
        openCount += 1;
        if (openCount === 1) {
          throw new Error(
            `Catalog Error: Failure while replaying WAL file "${walPath}": Table with name "session_seed" already exists!`,
          );
        }
        return {
          instance: fakeInstance,
          connection: fakeConnection,
        };
      },
      backupWal: backupProfileDatabaseWal,
      warn: (message) => {
        warnings.push(message);
      },
    });

    expect(isRecoverableProfileDatabaseWalError(new Error("Failure while replaying WAL file x: already exists"))).toBe(
      true,
    );
    expect(openCount).toBe(2);
    expect(warnings).toHaveLength(1);
    expect(existsSync(walPath)).toBe(false);

    await database.close();
  });
});

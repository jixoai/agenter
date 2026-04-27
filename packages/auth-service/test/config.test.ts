import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAuthServiceConfig } from "../src/config";

describe("Feature: auth-service configuration", () => {
  test("Scenario: Given explicit data dir When config resolves Then it uses auth-service database naming", () => {
    const dataDir = mkdtempSync(join(tmpdir(), "auth-service-config-"));
    const config = resolveAuthServiceConfig({ dataDir });

    expect(config.dataDir).toBe(dataDir);
    expect(config.dbPath).toBe(join(dataDir, "auth-service.duckdb"));
    expect(config.usedLegacyDataDir).toBe(false);
  });

  test("Scenario: Given legacy data dir compatibility When config receives that dir explicitly Then it keeps a single writable store", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "auth-service-config-"));
    const dataDir = join(rootDir, "profile-service");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, "profile-service.duckdb"), "");

    const config = resolveAuthServiceConfig({ dataDir });

    expect(config.dataDir).toBe(dataDir);
    expect(config.dbPath).toBe(join(dataDir, "profile-service.duckdb"));
    expect(config.usedLegacyDataDir).toBe(true);
  });
});

import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  REAL_SEMANTIC_JUDGE_PROVIDER_ID,
  resolveRealSemanticJudgeAvailability,
} from "../test-support/real-semantic-judge";

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

describe("Feature: fixed real semantic judge provider resolution", () => {
  test("Scenario: Given project settings define the fixed test provider When availability is resolved Then the canonical provider config is returned", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-real-semantic-provider-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(homeDir, ".agenter", "settings.json"), {
      ai: {
        providers: {
          [REAL_SEMANTIC_JUDGE_PROVIDER_ID]: {
            kind: "deepseek",
            apiKey: "user-key",
            model: "deepseek-chat",
            baseUrl: "https://api.deepseek.com/v1",
          },
        },
      },
    });
    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      ai: {
        providers: {
          [REAL_SEMANTIC_JUDGE_PROVIDER_ID]: {
            apiStandard: "openai-chat",
            vendor: "openrouter",
            model: "gpt-4.1-mini",
            apiKey: "project-key",
            baseUrl: "https://openrouter.ai/api/v1",
          },
        },
      },
    });

    const availability = await resolveRealSemanticJudgeAvailability({
      projectRoot,
      homeDir,
    });

    expect(availability.available).toBe(true);
    expect(availability.providerId).toBe(REAL_SEMANTIC_JUDGE_PROVIDER_ID);
    expect(availability.config).toMatchObject({
      providerId: REAL_SEMANTIC_JUDGE_PROVIDER_ID,
      apiStandard: "openai-chat",
      vendor: "openrouter",
      model: "gpt-4.1-mini",
      apiKey: "project-key",
      baseUrl: "https://openrouter.ai/api/v1",
    });
  });

  test("Scenario: Given the fixed provider is absent When availability is resolved Then the warning names both supported settings locations", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-real-semantic-provider-missing-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    const availability = await resolveRealSemanticJudgeAvailability({
      projectRoot,
      homeDir,
    });

    expect(availability.available).toBe(false);
    expect(availability.warning).toContain(REAL_SEMANTIC_JUDGE_PROVIDER_ID);
    expect(availability.warning).toContain(join(projectRoot, ".agenter", "settings.json"));
    expect(availability.warning).toContain(join(homeDir, ".agenter", "settings.json"));
  });

  test("Scenario: Given the fixed provider references an env credential that is unset When availability is resolved Then the warning exposes the missing credential hint", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "agenter-real-semantic-provider-cred-"));
    const homeDir = join(baseDir, "home");
    const projectRoot = join(baseDir, "project");

    await writeJson(join(projectRoot, ".agenter", "settings.json"), {
      ai: {
        providers: {
          [REAL_SEMANTIC_JUDGE_PROVIDER_ID]: {
            kind: "deepseek",
            apiKeyEnv: "DEEPSEEK_API_KEY",
            model: "deepseek-chat",
            baseUrl: "https://api.deepseek.com/v1",
          },
        },
      },
    });

    const availability = await resolveRealSemanticJudgeAvailability({
      projectRoot,
      homeDir,
    });

    expect(availability.available).toBe(false);
    expect(availability.warning).toContain("DEEPSEEK_API_KEY");
  });
});

import { describe, expect, test } from "bun:test";
import { fileURLToPath } from "node:url";

import { runtimeBuiltinSkillCatalog } from "../src/generated/runtime-skill-catalog.generated";
import { buildRuntimeBuiltinSkillCatalog } from "../src/runtime-skill-catalog-builder";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

describe("Feature: runtime built-in skill catalog generation", () => {
  test("Scenario: Given package-owned skill sources When the catalog is rebuilt Then the generated module stays in sync with source files", () => {
    const rebuilt = buildRuntimeBuiltinSkillCatalog(repoRoot);
    expect(rebuilt).toEqual([...runtimeBuiltinSkillCatalog]);
    expect(rebuilt.map((entry) => entry.name)).toEqual([
      "agenter-attention",
      "agenter-collaboration",
      "agenter-message",
      "agenter-runtime",
      "agenter-terminal",
      "agenter-workspace",
    ]);
  });
});

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

  test("Scenario: Given generated built-in skills When catalog templates are inspected Then removed pollution terms stay out of generated guidance", () => {
    const pollutedTerms = [
      "self_update",
      "no_external_reply_needed",
      "room_reply_pending",
      "required_room_reply_sent",
      "chatTurnState",
      "chatObligationKind",
      "settlesWhen",
      "originAckFallback",
    ];

    const joinedTemplates = runtimeBuiltinSkillCatalog.map((entry) => entry.template).join("\n");
    for (const term of pollutedTerms) {
      expect(joinedTemplates).not.toContain(term);
    }
  });
});

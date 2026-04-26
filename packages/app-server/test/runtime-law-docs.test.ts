import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

const readRepoFile = (relativePath: string): string => readFileSync(resolve(repoRoot, relativePath), "utf8");

const currentRuntimeLawFiles = [
  "SPEC.md",
  "packages/app-server/SPEC.md",
  "openspec/specs/attention-bootstrap-protocol/spec.md",
  "openspec/specs/attention-cycle-frame/spec.md",
  "openspec/specs/attention-egress-routing/spec.md",
  "openspec/specs/attention-native-context-graph/spec.md",
  "openspec/specs/attention-runtime-kernel/spec.md",
  "openspec/specs/attention-source-plugins/spec.md",
  "openspec/specs/attention-trace-publication/spec.md",
  "openspec/specs/attention-trace-spans/spec.md",
  "openspec/specs/loopbus-attention-output-pipeline/spec.md",
  "openspec/specs/loopbus-plugin-pipeline/spec.md",
  "openspec/specs/session-runtime-attention-message/spec.md",
];

describe("Feature: runtime law documentation", () => {
  test("Scenario: Given current durable runtime law docs When they are inspected Then legacy egress vocabulary is absent", () => {
    for (const relativePath of currentRuntimeLawFiles) {
      expect(readRepoFile(relativePath), relativePath).not.toMatch(/\begress\b/i);
    }
  });

  test("Scenario: Given attention and session package docs When they are inspected Then current plain-language roles are documented", () => {
    expect(readRepoFile("packages/attention-system/src/attention-system.ts")).toContain("Context + Items");
    expect(readRepoFile("packages/session-system/src/session-db.ts")).toContain("AI-call historian");
  });
});

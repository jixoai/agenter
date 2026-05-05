import { describe, expect, test } from "bun:test";

import {
  buildManagedSeatSituationBrief,
  findManagedSeatPromptLawViolations,
  getManagedSeatValidationScenario,
  listManagedSeatValidationScenarios,
  MANAGED_SEAT_PROMPT_LAW,
  MANAGED_SEAT_REQUIRED_ARCHETYPES,
} from "../test-support/managed-seat-scenario-catalog";
import { formatManagedSeatValidationFailure } from "../test-support/managed-seat-validation-harness";

describe("Feature: managed-seat scenario catalog", () => {
  test("Scenario: Given the managed-seat validation catalog When it is inspected Then every required realistic archetype is present exactly once", () => {
    const archetypes = listManagedSeatValidationScenarios().map((scenario) => scenario.archetype);

    expect(new Set(archetypes)).toEqual(new Set(MANAGED_SEAT_REQUIRED_ARCHETYPES));
    expect(archetypes).toHaveLength(MANAGED_SEAT_REQUIRED_ARCHETYPES.length);
  });

  test("Scenario: Given each managed-seat scenario When a situation brief is rendered Then the brief stays orthogonal instead of prescribing exact commands", () => {
    for (const scenario of listManagedSeatValidationScenarios()) {
      const brief = buildManagedSeatSituationBrief(scenario);
      expect(brief).toContain("Situation");
      expect(brief).toContain("Objective");
      expect(brief).toContain("Invariants");
      expect(findManagedSeatPromptLawViolations(brief)).toEqual([]);
    }
  });

  test("Scenario: Given the room-routed and cross-instance archetypes When setup is inspected Then the shared-room precondition is explicit instead of being hidden inside the objective", () => {
    expect(getManagedSeatValidationScenario("terminal-room-routed-delivery").setup.sharedRoomRequired).toBe(true);
    expect(getManagedSeatValidationScenario("terminal-cross-instance-collaboration").setup.sharedRoomRequired).toBe(
      true,
    );
    expect(getManagedSeatValidationScenario("terminal-unilateral-config").setup.sharedRoomRequired).toBe(false);
  });

  test("Scenario: Given the prompt law reference When scenario authors inspect it Then it explains non-overfitting behavior in plain rules", () => {
    expect(MANAGED_SEAT_PROMPT_LAW.join("\n")).toContain("Do not prescribe exact command names");
    expect(MANAGED_SEAT_PROMPT_LAW.join("\n")).toContain("Judge success from durable room, seat, descriptor, and terminal facts.");
  });

  test("Scenario: Given failure evidence is packaged for a managed-seat runner When formatting the error Then durable diagnostics stay attached to the scenario failure", () => {
    const error = formatManagedSeatValidationFailure("terminal-pair-debugging", new Error("boom"), {
      roomTruth: ["descriptor"],
      seatTimeline: ["pending", "accepted"],
      descriptorProjection: "httpUrl",
      terminalObservation: "shared-write",
      roomAuthorityUrl: "http://127.0.0.1:4101",
    });

    expect(error.message).toContain("managed-seat validation failed (terminal-pair-debugging)");
    expect(error.message).toContain('"roomTruth"');
    expect(error.message).toContain('"seatTimeline"');
    expect(error.message).toContain('"descriptorProjection"');
    expect(error.message).toContain('"terminalObservation"');
    expect(error.message).toContain('"roomAuthorityUrl"');
  });
});

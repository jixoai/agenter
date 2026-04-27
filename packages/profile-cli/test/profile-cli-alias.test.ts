import { describe, expect, test } from "bun:test";
import { runAuthCli, runProfileCli } from "../src/index";

describe("Feature: profile-cli compatibility alias", () => {
  test("Scenario: Given a legacy import When it reads the runner Then it receives the auth-cli implementation", () => {
    expect(runProfileCli).toBe(runAuthCli);
  });
});

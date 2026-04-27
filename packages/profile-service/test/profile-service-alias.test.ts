import { describe, expect, test } from "bun:test";
import { startAuthServiceServer, startProfileServiceServer } from "../src/index";

describe("Feature: profile-service compatibility alias", () => {
  test("Scenario: Given a legacy import When it reads server helpers Then it receives the auth-service implementation", () => {
    expect(startProfileServiceServer).toBe(startAuthServiceServer);
  });
});

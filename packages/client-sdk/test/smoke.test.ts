import { describe, expect, test } from "bun:test";

import { createAgenterClient, createRuntimeStore } from "../src";

describe("Feature: client sdk exports", () => {
  test("Scenario: Given sdk module When importing Then runtime APIs are available", () => {
    expect(typeof createAgenterClient).toBe("function");
    expect(typeof createRuntimeStore).toBe("function");
  });
});

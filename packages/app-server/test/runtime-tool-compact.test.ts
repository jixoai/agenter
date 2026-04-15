import { describe, expect, test } from "bun:test";
import { toJSONSchema, z } from "zod";

import { runtimeToolDescriptors } from "../src/runtime-tool-descriptors";
import {
  buildRuntimeToolCompactSurface,
  decodeRuntimeToolCompactPayload,
  encodeRuntimeToolCompactPayload,
  renderRuntimeToolCompactFieldGuide,
} from "../src/runtime-tool-compact";

const getDescriptor = (key: string) => {
  const descriptor = runtimeToolDescriptors.find((item) => `${item.namespace}:${item.name}` === key);
  if (!descriptor) {
    throw new Error(`expected runtime descriptor: ${key}`);
  }
  return descriptor;
};

describe("Feature: runtime compact descriptor codec", () => {
  test("Scenario: Given an enum field When a compact payload is encoded and decoded Then the zero-based ordinal round-trips through the shared descriptor shape", () => {
    const descriptor = getDescriptor("terminal:focus");
    const surface = buildRuntimeToolCompactSurface(toJSONSchema(descriptor.inputSchema, { unrepresentable: "any" }));

    expect(surface.availability).toBe("Suggested");
    expect(encodeRuntimeToolCompactPayload(surface, { op: "replace", terminalIds: ["term-1"] })).toEqual([
      2,
      ["term-1"],
    ]);
    expect(decodeRuntimeToolCompactPayload(surface, [2, ["term-1"]])).toEqual({
      op: "replace",
      terminalIds: ["term-1"],
    });
    expect(renderRuntimeToolCompactFieldGuide(surface)).toContain(
      '- [0] op: 0="add", 1="remove", 2="replace", 3="clear"',
    );
  });

  test("Scenario: Given a discriminated union with skipped optional fields When compact mode is used Then the discriminator literal stays first and interior holes become null", () => {
    const descriptor = getDescriptor("attention:commit");
    const surface = buildRuntimeToolCompactSurface(toJSONSchema(descriptor.inputSchema, { unrepresentable: "any" }));

    expect(surface.availability).toBe("Available");
    expect(
      encodeRuntimeToolCompactPayload(surface, {
        contextId: "ctx-chat-main",
        summary: "done",
        change: {
          type: "update",
          value: "APP-URL: http://127.0.0.1:4173/",
          format: "text/plain",
        },
      }),
    ).toEqual([
      "ctx-chat-main",
      null,
      null,
      null,
      null,
      "done",
      ["update", "APP-URL: http://127.0.0.1:4173/", "text/plain"],
    ]);
    expect(
      decodeRuntimeToolCompactPayload(surface, [
        "ctx-chat-main",
        null,
        null,
        null,
        null,
        "done",
        ["update", "APP-URL: http://127.0.0.1:4173/", "text/plain"],
      ]),
    ).toEqual({
      contextId: "ctx-chat-main",
      summary: "done",
      change: {
        type: "update",
        value: "APP-URL: http://127.0.0.1:4173/",
        format: "text/plain",
      },
    });
    expect(renderRuntimeToolCompactFieldGuide(surface)).toContain(
      '- [6] change?: ["update", value, format?] | ["diff", value, format?] | ["clean"]',
    );
  });

  test("Scenario: Given a record subtree When compact mode is used Then dynamic keys become key-value entry arrays", () => {
    const surface = buildRuntimeToolCompactSurface(
      toJSONSchema(
        z.object({
          scores: z.record(z.string(), z.number()),
        }),
        { unrepresentable: "any" },
      ),
    );

    expect(encodeRuntimeToolCompactPayload(surface, { scores: { priority: 2, background: 1 } })).toEqual([
      [
        ["priority", 2],
        ["background", 1],
      ],
    ]);
    expect(
      decodeRuntimeToolCompactPayload(surface, [
        [
          ["priority", 2],
          ["background", 1],
        ],
      ]),
    ).toEqual({
      scores: {
        priority: 2,
        background: 1,
      },
    });
    expect(renderRuntimeToolCompactFieldGuide(surface)).toContain("- [0] scores: [[key, number], ...]");
  });
});

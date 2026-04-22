import { describe, expect, test } from "bun:test";

import { keyToSequence, parseMixedInput, runMixedInput } from "../src/input-parser";

describe("Feature: mixed terminal input parsing", () => {
  test("Scenario: Given ctrl and named keys When converting them to sequences Then the terminal bytes stay deterministic", () => {
    expect(keyToSequence("c", true)).toBe("\u0003");
    expect(keyToSequence("enter", false)).toBe("\r");
    expect(keyToSequence("up", false)).toBe("\u001b[A");
  });

  test("Scenario: Given a mixed payload with raw blocks When parsing Then literal text and terminal actions keep their authored order", () => {
    const actions = parseMixedInput(
      `echo hi<key data="enter"/><raw>&lt;key data=&quot;enter&quot;/&gt;</raw><wait ms="300"/>next`,
    );

    expect(actions).toEqual([
      { type: "text", data: "echo hi" },
      { type: "key", data: "enter", ctrl: false, times: 1 },
      { type: "text", data: '<key data="enter"/>' },
      { type: "wait", ms: 300 },
      { type: "text", data: "next" },
    ]);
  });

  test("Scenario: Given a raw block without a closing tag When parsing mixed input Then terminal-core rejects the payload", () => {
    expect(() => parseMixedInput("<raw>unterminated")).toThrow("mixed input raw block is missing </raw>");
  });

  test("Scenario: Given mixed terminal input When replaying the actions Then writes and waits run sequentially", async () => {
    const writes: string[] = [];
    const waits: number[] = [];

    await runMixedInput(`a<key data="up" times="2"/><wait ms="5"/>b<key data="c" ctrl="true"/>`, {
      write: (data) => writes.push(data),
      wait: async (ms) => {
        waits.push(ms);
        await Bun.sleep(0);
      },
    });

    expect(writes).toEqual(["a", "\u001b[A\u001b[A", "b", "\u0003"]);
    expect(waits).toEqual([5]);
  });
});

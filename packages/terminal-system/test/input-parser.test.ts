import { expect, test } from "bun:test";

import { keyToSequence, parseMixedInput, runMixedInput } from "../src/input-parser";

test("keyToSequence resolves ctrl and named keys", () => {
  expect(keyToSequence("c", true)).toBe("\u0003");
  expect(keyToSequence("enter", false)).toBe("\r");
  expect(keyToSequence("up", false)).toBe("\u001b[A");
});

test("parseMixedInput keeps order between text/key/wait", () => {
  const actions = parseMixedInput(`echo hi<key data="enter"/><wait ms="300"/>next`);
  expect(actions).toEqual([
    { type: "text", data: "echo hi" },
    { type: "key", data: "enter", ctrl: false, times: 1 },
    { type: "wait", ms: 300 },
    { type: "text", data: "next" },
  ]);
});

test("runMixedInput executes sequential writes", async () => {
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

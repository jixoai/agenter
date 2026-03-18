import { expect, test } from "bun:test";

import { Committer } from "../src/committer";

test("committer coalesces with debounce", async () => {
  const calls: string[] = [];
  const committer = new Committer({ debounceMs: 25, throttleMs: 100 });

  committer.schedule({ plainText: "1", commit: () => void calls.push("1") });
  await Bun.sleep(5);
  committer.schedule({ plainText: "2", commit: () => void calls.push("2") });
  await Bun.sleep(5);
  committer.schedule({ plainText: "3", commit: () => void calls.push("3") });
  await Bun.sleep(45);

  expect(calls).toEqual(["3"]);
  committer.stop();
});

test("committer skips commit when plain text unchanged", async () => {
  let count = 0;
  const committer = new Committer({ debounceMs: 10, throttleMs: 80 });

  committer.schedule({ plainText: "same", commit: () => void (count += 1) });
  await Bun.sleep(20);
  committer.schedule({ plainText: "same", commit: () => void (count += 1) });
  await Bun.sleep(20);

  expect(count).toBe(1);
  committer.stop();
});

test("committer forces periodic commit with throttle under heavy updates", async () => {
  let count = 0;
  const committer = new Committer({ debounceMs: 200, throttleMs: 60 });

  for (let index = 0; index < 6; index += 1) {
    committer.schedule({
      plainText: `line-${index}`,
      commit: () => void (count += 1),
    });
    await Bun.sleep(20);
  }

  await Bun.sleep(120);
  expect(count).toBeGreaterThan(0);
  committer.stop();
});

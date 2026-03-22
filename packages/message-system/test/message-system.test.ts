import { describe, expect, test } from "bun:test";

import { MessageSystem } from "../src/message-system";

describe("Feature: message-system committed drafts", () => {
  test("Scenario: Given default user channel When pushing and consuming diff Then drafts emit once and queue clears", () => {
    const system = new MessageSystem();

    const pushed = system.push({
      content: "hi agenter",
      timestamp: 1,
      meta: { source: "chat" },
    });

    expect(system.getHeadHash()).toBe("1");
    expect(system.getDirty()).toHaveLength(1);

    const diff = system.consumeDiff();
    expect(diff.changed).toBe(true);
    expect(diff.fromHash).toBeNull();
    expect(diff.toHash).toBe("1");
    expect(diff.drafts).toEqual([
      {
        ...pushed,
        meta: { source: "chat" },
      },
    ]);

    expect(system.getDirty()).toHaveLength(0);
    expect(system.consumeDiff({ fromHash: diff.toHash }).changed).toBe(false);
  });

  test("Scenario: Given waiter after current hash When a new message commits Then waitCommitted resolves and canceled waiters reject", async () => {
    const system = new MessageSystem([{ channelId: "slack", displayName: "Slack", useAttention: true }]);

    const first = system.push({ channelId: "user", content: "seed" });
    const currentHash = system.getHeadHash();
    expect(currentHash).toBe("1");
    expect(first.channelId).toBe("user");

    const waiter = system.waitCommitted({ fromHash: currentHash });
    const loser = system.waitCommitted({ fromHash: currentHash });
    const loserPromise = loser.promise.catch((error) => error);
    loser.reject(new Error("ignore"));

    system.push({ channelId: "slack", content: "new input" });

    await expect(waiter.promise).resolves.toEqual({ toHash: "2" });
    await expect(loserPromise).resolves.toBeInstanceOf(Error);
    await expect(loserPromise).resolves.toMatchObject({ message: "ignore" });
  });

  test("Scenario: Given custom channels When user channel is omitted Then adapter-facing channel metadata remains stable", () => {
    const system = new MessageSystem([{ channelId: "background", displayName: "Background", useAttention: false }]);

    expect(system.getChannel("user")).toEqual({
      channelId: "user",
      displayName: "User",
      useAttention: true,
    });
    expect(system.getChannel("background")).toEqual({
      channelId: "background",
      displayName: "Background",
      useAttention: false,
    });

    const copy = system.getChannel("background");
    if (!copy) {
      throw new Error("background channel missing");
    }
    copy.displayName = "mutated";
    expect(system.getChannel("background")?.displayName).toBe("Background");
  });
});

import type { ProfileServiceHandle } from "@agenter/profile-service";
import { describe, expect, test } from "bun:test";
import { ProfileServiceBridge } from "../src/profile-service-bridge";

class TestProfileServiceBridge extends ProfileServiceBridge {
  startCount = 0;
  stopCount = 0;

  protected override async startChildHandle(): Promise<ProfileServiceHandle> {
    this.startCount += 1;
    await Bun.sleep(20);
    return {
      host: "127.0.0.1",
      port: 4591,
      stop: async () => {
        this.stopCount += 1;
      },
    };
  }
}

describe("Feature: profile-service bridge startup", () => {
  test("Scenario: Given concurrent profile-service requests When the child runtime is still booting Then the bridge starts only one child handle", async () => {
    const bridge = new TestProfileServiceBridge();

    const [baseUrl, described, secondBaseUrl] = await Promise.all([
      bridge.getBaseUrl(),
      bridge.describe(),
      bridge.getBaseUrl(),
    ]);

    expect(baseUrl).toBe("http://127.0.0.1:4591");
    expect(described.endpoint).toBe("http://127.0.0.1:4591");
    expect(secondBaseUrl).toBe("http://127.0.0.1:4591");
    expect(bridge.startCount).toBe(1);

    await bridge.stop();
    expect(bridge.stopCount).toBe(1);
  });
});

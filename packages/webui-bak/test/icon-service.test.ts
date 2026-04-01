import { describe, expect, test, vi } from "vitest";

import { createIconServiceUrls } from "../src/features/profile/icon-service";

describe("Feature: icon service URL helpers", () => {
  test("Scenario: Given blank identifiers When building icon URLs Then only normalized session/profile references resolve", () => {
    const profileIconUrl = vi.fn((reference: string) => `http://127.0.0.1:4591/media/profiles/${reference}/icon`);
    const sessionIconUrl = vi.fn((sessionId: string) => `http://127.0.0.1:4591/media/sessions/${sessionId}/icon`);
    const iconUrls = createIconServiceUrls({
      profileIconUrl,
      sessionIconUrl,
    });

    expect(iconUrls.profile(" gaubee ")).toBe("http://127.0.0.1:4591/media/profiles/gaubee/icon");
    expect(iconUrls.profile("")).toBeNull();
    expect(iconUrls.profile("   ")).toBeNull();
    expect(iconUrls.profile(null)).toBeNull();
    expect(iconUrls.session(" session-1 ")).toBe("http://127.0.0.1:4591/media/sessions/session-1/icon");
    expect(iconUrls.session(undefined)).toBeNull();

    expect(profileIconUrl).toHaveBeenCalledWith("gaubee");
    expect(sessionIconUrl).toHaveBeenCalledWith("session-1");
  });
});

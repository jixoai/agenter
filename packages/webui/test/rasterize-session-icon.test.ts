import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { rasterizeSessionIconFallback } from "../src/features/profile/rasterize-session-icon";

const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
const OriginalImage = globalThis.Image;
const originalCreateElement = document.createElement.bind(document);

class FakeImage {
  decoding = "async";
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(_value: string) {
    queueMicrotask(() => {
      this.onload?.();
    });
  }
}

describe("Feature: session icon rasterization", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    URL.createObjectURL = vi.fn(() => "blob:mock-icon");
    URL.revokeObjectURL = vi.fn();
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("OffscreenCanvas", undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    URL.createObjectURL = originalCreateObjectUrl;
    URL.revokeObjectURL = originalRevokeObjectUrl;
    globalThis.Image = OriginalImage;
    document.createElement = originalCreateElement;
  });

  test("Scenario: Given a session fallback svg When rasterized Then a webp file is produced for upload", async () => {
    const clearRect = vi.fn();
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: BlobCallback, type?: string) => {
      callback(new Blob(["webp"], { type: type ?? "image/webp" }));
    });
    const canvasStub = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({ clearRect, drawImage })),
      toBlob,
    };
    document.createElement = vi.fn((tagName: string) => {
      if (tagName === "canvas") {
        return canvasStub as unknown as HTMLCanvasElement;
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;

    vi.mocked(fetch).mockResolvedValue(
      new Response('<svg xmlns="http://www.w3.org/2000/svg"></svg>', {
        status: 200,
        headers: {
          "content-type": "image/svg+xml",
        },
      }),
    );

    const file = await rasterizeSessionIconFallback({
      iconUrl: "http://localhost/media/sessions/session-42/icon",
    });

    expect(fetch).toHaveBeenCalledWith("http://localhost/media/sessions/session-42/icon", { cache: "force-cache" });
    expect(file).not.toBeNull();
    expect(file?.name).toBe("session-icon.webp");
    expect(file?.type).toBe("image/webp");
    expect(drawImage).toHaveBeenCalledTimes(1);
    expect(clearRect).toHaveBeenCalledWith(0, 0, 96, 96);
    expect(toBlob).toHaveBeenCalledTimes(1);
  });

  test("Scenario: Given a non-svg session icon response When rasterization starts Then upload generation is skipped", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: {
          "content-type": "image/webp",
        },
      }),
    );

    const file = await rasterizeSessionIconFallback({
      iconUrl: "http://localhost/media/sessions/session-99/icon",
    });

    expect(file).toBeNull();
  });
});

import { describe, expect, test } from "bun:test";
import { Resvg } from "@resvg/resvg-js";

import { renderAvatarFallbackSvg } from "../src/render/fallback-icons";
import { rasterizeSvg } from "../src/render/resvg-runtime";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="#00a86b"/><circle cx="16" cy="16" r="8" fill="#ffffff"/></svg>`;

const measureColoredPixelRatio = (pixels: Uint8Array): number => {
  let colored = 0;
  let opaque = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] ?? 0;
    if (alpha < 10) {
      continue;
    }
    opaque += 1;
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (saturation > 0.12) {
      colored += 1;
    }
  }
  return opaque === 0 ? 0 : colored / opaque;
};

describe("Feature: packaged resvg runtime", () => {
  test("Scenario: Given svg fallback artwork When png output is requested Then the packaged runtime returns png bytes", async () => {
    const bytes = await rasterizeSvg({
      svg: SVG,
      format: "png",
      width: 64,
      height: 64,
    });

    expect([...bytes.slice(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  test("Scenario: Given svg fallback artwork When jpeg output is requested Then the packaged runtime plus jpeg encoder preserves the raster contract", async () => {
    const bytes = await rasterizeSvg({
      svg: SVG,
      format: "jpeg",
      width: 64,
      height: 64,
    });

    expect([...bytes.slice(0, 3)]).toEqual([255, 216, 255]);
  });

  test("Scenario: Given avatar fallback artwork uses generated gradients When resvg rasterizes it Then the raster keeps saturated color instead of collapsing to monochrome", async () => {
    const svg = await renderAvatarFallbackSvg({
      principalId: "0xd524e3c2334831487acc57f1aa4277e59c9c8a3e",
      nickname: "default",
      displayName: "Default",
      classify: "assistant",
    });

    expect(svg).not.toContain("hsl(");
    const rendered = new Resvg(svg, { fitTo: { mode: "width", value: 128 } }).render();

    expect(measureColoredPixelRatio(rendered.pixels)).toBeGreaterThan(0.45);
  });

  test("Scenario: Given the packaged runtime cannot load on this host When rasterization is attempted Then the failure stays explicit", async () => {
    await expect(
      rasterizeSvg(
        {
          svg: SVG,
          format: "png",
          width: 64,
          height: 64,
        },
        async () => {
          throw new Error("mock missing native addon");
        },
      ),
    ).rejects.toThrow(`packaged resvg runtime is unavailable on ${process.platform}/${process.arch}`);
  });
});

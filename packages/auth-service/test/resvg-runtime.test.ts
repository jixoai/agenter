import { describe, expect, test } from "bun:test";

import { rasterizeSvg } from "../src/render/resvg-runtime";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect width="32" height="32" fill="#00a86b"/><circle cx="16" cy="16" r="8" fill="#ffffff"/></svg>`;

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

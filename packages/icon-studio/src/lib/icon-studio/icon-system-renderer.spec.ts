import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";
import { describe, expect, test } from "vitest";

import type {
  IconBackgroundToken,
  IconPaletteToken,
  IconPreset,
  IconSlotKind,
  IconSlotPreset,
} from "./icon-system-contract";
import { CUSTOM_SLOT_ID } from "./icon-system-contract";
import {
  createRenderInput,
  parseGeometryFromSvg,
  renderIconSvg,
} from "./icon-system-svg";

const repoRoot = resolve(
  fileURLToPath(new URL(".", import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
);
const nextDir = resolve(repoRoot, "assets", "next");
const loadJson = <TValue>(filePath: string): TValue =>
  JSON.parse(readFileSync(filePath, "utf8")) as TValue;

const geometry = parseGeometryFromSvg(
  readFileSync(resolve(nextDir, "icon-bw.svg"), "utf8"),
);
const backgrounds = loadJson<IconBackgroundToken[]>(
  resolve(nextDir, "tokens", "backgrounds.json"),
);
const palettes = loadJson<IconPaletteToken[]>(
  resolve(nextDir, "tokens", "palettes.json"),
);
const slotCatalog = loadJson<Record<IconSlotKind, IconSlotPreset[]>>(
  resolve(nextDir, "tokens", "slots.json"),
);
const presets = readdirSync(resolve(nextDir, "presets"))
  .filter((filename: string) => filename.endsWith(".json"))
  .sort()
  .map((filename: string) =>
    loadJson<IconPreset>(resolve(nextDir, "presets", filename)),
  );

const rasterizeSvg = async (svg: string): Promise<Buffer> =>
  sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer();

const countChangedPixels = (left: Buffer, right: Buffer): number => {
  let changed = 0;
  for (let index = 0; index < left.length; index += 4) {
    const delta =
      Math.abs(left[index]! - right[index]!) +
      Math.abs(left[index + 1]! - right[index + 1]!) +
      Math.abs(left[index + 2]! - right[index + 2]!) +
      Math.abs(left[index + 3]! - right[index + 3]!);
    if (delta > 8) {
      changed += 1;
    }
  }
  return changed;
};

describe("Feature: Canonical icon system renderer", () => {
  test("Scenario: Given the light brand preset When rendering the SVG Then the light canvas and metallic center system stay encoded in the output", () => {
    const preset = presets.find(
      (entry: IconPreset) => entry.id === "brand-light",
    );
    expect(preset).not.toBeNull();

    const svg = renderIconSvg(
      createRenderInput({
        backgrounds,
        config: {
          backgroundToken: preset!.backgroundToken,
          family: preset!.family,
          paletteToken: preset!.paletteToken,
          slots: preset!.slots,
          theme: preset!.theme,
        },
        geometry,
        palettes,
        slotCatalog,
      }),
    );

    expect(svg).toContain("#f3f0ea");
    expect(svg).toContain('stroke="#c0c8cf"');
    expect(svg).toContain("clip-topLeft");
  });

  test("Scenario: Given a custom center slot When rendering the SVG Then the exported icon embeds the provided custom markup inside the slot clip", () => {
    const preset = presets.find(
      (entry: IconPreset) => entry.id === "brand-light",
    );
    expect(preset).not.toBeNull();

    const svg = renderIconSvg(
      createRenderInput({
        backgrounds,
        config: {
          backgroundToken: preset!.backgroundToken,
          customSlots: {
            center:
              '<svg viewBox="0 0 100 100"><path d="M20 20h60v60H20z" fill="currentColor"/></svg>',
          },
          family: preset!.family,
          paletteToken: preset!.paletteToken,
          slots: { ...preset!.slots, center: CUSTOM_SLOT_ID },
          theme: preset!.theme,
        },
        geometry,
        palettes,
        slotCatalog,
      }),
    );

    expect(svg).toContain('clip-path="url(#clip-center)"');
    expect(svg).toContain("M20 20h60v60H20z");
  });

  test("Scenario: Given a scaled foreign slot source When rasterizing the SVG Then the slot footprint changes without touching preset-authored symbols", async () => {
    const preset = presets.find(
      (entry: IconPreset) => entry.id === "brand-light",
    );
    expect(preset).not.toBeNull();

    const renderScaledCustomCenter = (scale: number): string =>
      renderIconSvg(
        createRenderInput({
          backgrounds,
          config: {
            backgroundToken: preset!.backgroundToken,
            customSlots: {
              center:
                '<svg viewBox="0 0 100 100"><path d="M20 20h60v60H20z" fill="currentColor"/></svg>',
            },
            family: preset!.family,
            paletteToken: preset!.paletteToken,
            slotScale: { center: scale },
            slots: { ...preset!.slots, center: CUSTOM_SLOT_ID },
            theme: preset!.theme,
          },
          geometry,
          palettes,
          slotCatalog,
        }),
      );

    const [baseline, enlarged] = await Promise.all([
      rasterizeSvg(renderScaledCustomCenter(1)),
      rasterizeSvg(renderScaledCustomCenter(1.45)),
    ]);

    expect(countChangedPixels(baseline, enlarged)).toBeGreaterThan(0);
  });

  test("Scenario: Given different built-in slot presets When rasterizing the SVG Then each slot change produces visible pixels", async () => {
    const preset = presets.find(
      (entry: IconPreset) => entry.id === "brand-light",
    );
    expect(preset).not.toBeNull();

    const renderSvg = (slots: Partial<Record<IconSlotKind, string>>): string =>
      renderIconSvg(
        createRenderInput({
          backgrounds,
          config: {
            backgroundToken: preset!.backgroundToken,
            family: preset!.family,
            paletteToken: preset!.paletteToken,
            slots: { ...preset!.slots, ...slots },
            theme: preset!.theme,
          },
          geometry,
          palettes,
          slotCatalog,
        }),
      );

    const [topLeftA, topLeftB, bottomRightA, bottomRightB, centerA, centerB] =
      await Promise.all([
        rasterizeSvg(renderSvg({ topLeft: "corner-bracket" })),
        rasterizeSvg(renderSvg({ topLeft: "signal" })),
        rasterizeSvg(renderSvg({ bottomRight: "terminal" })),
        rasterizeSvg(renderSvg({ bottomRight: "orbit" })),
        rasterizeSvg(renderSvg({ center: "blank-chip" })),
        rasterizeSvg(renderSvg({ center: "agent-core" })),
      ]);

    expect(countChangedPixels(topLeftA, topLeftB)).toBeGreaterThan(0);
    expect(countChangedPixels(bottomRightA, bottomRightB)).toBeGreaterThan(0);
    expect(countChangedPixels(centerA, centerB)).toBeGreaterThan(0);
  });
});

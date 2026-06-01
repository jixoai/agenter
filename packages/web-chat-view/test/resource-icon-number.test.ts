import { describe, expect, test } from "vitest";

import {
  normalizeResourceIconExtension,
  normalizeResourceIconNumber,
  resolveResourceIconNumber,
} from "../src/components/resource-icon-number";

describe("Feature: Resource icon number normalization", () => {
  test("Scenario: Given resource labels When numbers are rendered Then only 1 through 9 remain literal", () => {
    expect(normalizeResourceIconNumber("Comment 1")).toBe("1");
    expect(normalizeResourceIconNumber("[^File 9]")).toBe("9");
    expect(normalizeResourceIconNumber("Image 10")).toBe("*");
    expect(normalizeResourceIconNumber("Comment")).toBe("*");
  });

  test("Scenario: Given token fallback data When label has no number Then token text or id may resolve the icon number", () => {
    expect(resolveResourceIconNumber({ label: "Screenshot", tokenText: "[^Image 3]", id: "image-8" })).toBe("3");
    expect(resolveResourceIconNumber({ label: "Attachment", id: "asset-2" })).toBe("2");
    expect(resolveResourceIconNumber({ label: "Attachment", tokenText: "[^File 12]", id: "asset-2" })).toBe("*");
  });

  test("Scenario: Given file extension inputs When the icon renders Then extension text is normalized for the file badge", () => {
    expect(normalizeResourceIconExtension("pdf", "brief.pdf")).toBe("PDF");
    expect(normalizeResourceIconExtension(undefined, "archive.tar.gz")).toBe("GZ");
    expect(normalizeResourceIconExtension(".mdoc", undefined)).toBe("MDOC");
  });
});

import { describe, expect, test } from "vitest";

import { isFilePreviewPayload, type FilePreviewPayload } from "./file-preview-state";

const createTextPreview = (projection?: FilePreviewPayload["textProjection"]): FilePreviewPayload => ({
  path: "/notes/example.md",
  name: "example.md",
  kind: "file",
  sizeBytes: 42,
  modifiedAtMs: 1,
  previewKind: "text",
  mimeType: "text/markdown",
  textContent: "# Example",
  mediaDataUrl: null,
  truncated: false,
  note: null,
  ...(projection ? { textProjection: projection } : {}),
});

describe("Feature: file preview payload contract", () => {
  test("Scenario: Given text previews When validating projections Then source and document are accepted while invalid projections fail", () => {
    expect(isFilePreviewPayload(createTextPreview())).toBe(true);
    expect(isFilePreviewPayload(createTextPreview("source"))).toBe(true);
    expect(isFilePreviewPayload(createTextPreview("document"))).toBe(true);
    expect(isFilePreviewPayload({ ...createTextPreview(), textProjection: "rendered" })).toBe(false);
  });
});

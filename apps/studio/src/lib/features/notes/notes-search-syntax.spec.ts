import { describe, expect, test } from "vitest";

import { parseNotesSearchSyntax, upsertNotesSearchTag } from "./notes-search-syntax";

describe("Feature: Notes search syntax", () => {
  test("Scenario: Given tag syntax and free text When Notes parses search input Then tag filters and full text stay separate", () => {
    expect(parseNotesSearchSyntax("tag:ux 哈哈哈 tag:Product")).toEqual({
      query: "哈哈哈",
      tags: ["ux", "product"],
    });
  });

  test("Scenario: Given repeated tag clicks When Notes updates search input Then duplicate tag tokens are not added", () => {
    expect(upsertNotesSearchTag("tag:ux 哈哈哈", "UX")).toBe("tag:ux 哈哈哈");
    expect(upsertNotesSearchTag("哈哈哈", "ux")).toBe("哈哈哈 tag:ux");
  });

  test("Scenario: Given empty results When a tag is selected Then Notes can replace the input with a tag-only query", () => {
    expect(upsertNotesSearchTag("missing phrase", "ux", { replace: true })).toBe("tag:ux");
  });
});

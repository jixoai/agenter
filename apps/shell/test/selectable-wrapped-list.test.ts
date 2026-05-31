import { BoxRenderable } from "@opentui/core";
import { createTestRenderer } from "@opentui/core/testing";
import { describe, expect, test } from "bun:test";

import { createBorderedContentRegionMapper } from "../src/app-navigation/screen-region";
import { SelectableWrappedList, type SelectableWrappedListItem } from "../src/app-navigation/selectable-wrapped-list";

const pad = (value: string, width: number): string => value.padEnd(width, " ").slice(0, width);

describe("Feature: OpenTUI selectable wrapped list", () => {
  test("Scenario: Given a bordered parent and a multi-line item When clicked Then selection and confirmation resolve to the logical item", async () => {
    const setup = await createTestRenderer({ width: 40, height: 10, useMouse: true });
    const root = new BoxRenderable(setup.renderer, {
      id: "test-selectable-list-root",
      position: "absolute",
      top: 0,
      left: 0,
      width: 30,
      height: 8,
      border: true,
      backgroundColor: "#0f172a",
    });
    setup.renderer.root.add(root);
    const items = ["alpha", "wrapped"] as const;
    let selectedIndex = 0;
    const confirmed: string[] = [];
    const renderItem = (item: (typeof items)[number]): SelectableWrappedListItem =>
      item === "wrapped"
        ? {
            lines: [
              { plainText: "wrapped line 1", content: "wrapped line 1" },
              { plainText: "wrapped line 2", content: "wrapped line 2" },
            ],
          }
        : { lines: [{ plainText: item, content: item }] };
    const list = new SelectableWrappedList<(typeof items)[number]>({
      renderer: setup.renderer,
      parent: root,
      idPrefix: "test-selectable-list-row",
      regionMapper: createBorderedContentRegionMapper(root),
      formatLine: ({ line, prefix, width }) => pad(`${prefix}${line.plainText}`, width),
      onSelectionChange: (index) => {
        selectedIndex = index;
      },
      onConfirm: (_index, item) => {
        confirmed.push(item);
      },
    });
    root.onMouseDown = (event) => {
      if (list.handleMouseDown(event)) {
        list.render({
          items,
          selectedIndex,
          top: 1,
          left: 2,
          width: 20,
          itemWidth: 18,
          availableRows: 5,
          renderItem,
        });
      }
    };
    root.onMouseUp = (event) => {
      list.handleMouseUp(event);
    };
    list.render({
      items,
      selectedIndex,
      top: 1,
      left: 2,
      width: 20,
      itemWidth: 18,
      availableRows: 5,
      renderItem,
    });
    await setup.renderOnce();

    await setup.mockMouse.pressDown(4, 4);
    await setup.renderOnce();
    expect(selectedIndex).toBe(1);
    expect(confirmed).toEqual([]);

    await setup.mockMouse.release(4, 4);
    await setup.renderOnce();
    setup.renderer.destroy();

    expect(confirmed).toEqual(["wrapped"]);
  });
});

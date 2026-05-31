import {
  MouseButton,
  TextRenderable,
  type BoxRenderable,
  type CliRenderer,
  type MouseEvent,
  type StyledText,
} from "@opentui/core";

import { screenRegionContains, type ScreenRegion, type ScreenRegionMapper } from "./screen-region";

export interface SelectableWrappedListLine {
  readonly plainText: string;
  readonly content: string | StyledText;
}

export interface SelectableWrappedListItem {
  readonly lines: readonly SelectableWrappedListLine[];
}

export interface SelectableWrappedListRenderInput<T> {
  readonly items: readonly T[];
  readonly selectedIndex: number;
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly itemWidth: number;
  readonly availableRows: number;
  readonly renderItem: (item: T, width: number) => SelectableWrappedListItem;
}

export interface SelectableWrappedListInput<T> {
  readonly renderer: CliRenderer;
  readonly parent: BoxRenderable;
  readonly idPrefix: string;
  readonly regionMapper: ScreenRegionMapper;
  readonly formatLine: (input: {
    readonly line: SelectableWrappedListLine;
    readonly prefix: string;
    readonly width: number;
    readonly selected: boolean;
    readonly lineIndex: number;
  }) => string | StyledText;
  readonly onSelectionChange: (index: number, item: T) => void;
  readonly onConfirm: (index: number, item: T) => void | Promise<void>;
  readonly fg?: string;
  readonly bg?: string;
  readonly selectedFg?: string;
  readonly selectedBg?: string;
}

interface ItemRegion {
  readonly index: number;
  readonly region: ScreenRegion;
}

interface PressTarget {
  readonly index: number;
}

const clampIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(length - 1, index));
};

const firstVisibleIndex = (heights: readonly number[], selectedIndex: number, availableRows: number): number => {
  let firstIndex = 0;
  let usedRows = 0;
  for (let index = 0; index <= selectedIndex && index < heights.length; index += 1) {
    const itemRows = Math.max(1, heights[index] ?? 1);
    while (usedRows + itemRows > availableRows && firstIndex < index) {
      usedRows -= Math.max(1, heights[firstIndex] ?? 1);
      firstIndex += 1;
    }
    usedRows += itemRows;
  }
  return firstIndex;
};

export class SelectableWrappedList<T> {
  readonly #renderer: CliRenderer;
  readonly #parent: BoxRenderable;
  readonly #idPrefix: string;
  readonly #regionMapper: ScreenRegionMapper;
  readonly #formatLine: SelectableWrappedListInput<T>["formatLine"];
  readonly #onSelectionChange: SelectableWrappedListInput<T>["onSelectionChange"];
  readonly #onConfirm: SelectableWrappedListInput<T>["onConfirm"];
  readonly #fg: string;
  readonly #bg: string;
  readonly #selectedFg: string;
  readonly #selectedBg: string;
  readonly #rows: TextRenderable[] = [];
  #items: readonly T[] = [];
  #selectedIndex = 0;
  #regions: ItemRegion[] = [];
  #pressTarget: PressTarget | null = null;

  constructor(input: SelectableWrappedListInput<T>) {
    this.#renderer = input.renderer;
    this.#parent = input.parent;
    this.#idPrefix = input.idPrefix;
    this.#regionMapper = input.regionMapper;
    this.#formatLine = input.formatLine;
    this.#onSelectionChange = input.onSelectionChange;
    this.#onConfirm = input.onConfirm;
    this.#fg = input.fg ?? "#cbd5e1";
    this.#bg = input.bg ?? "#0f172a";
    this.#selectedFg = input.selectedFg ?? "#f8fafc";
    this.#selectedBg = input.selectedBg ?? "#1e3a8a";
  }

  moveSelection(delta: number): boolean {
    const nextIndex = clampIndex(this.#selectedIndex + delta, this.#items.length);
    if (nextIndex === this.#selectedIndex) {
      return false;
    }
    const item = this.#items[nextIndex];
    if (!item) {
      return false;
    }
    this.#selectedIndex = nextIndex;
    this.#onSelectionChange(nextIndex, item);
    return true;
  }

  render(input: SelectableWrappedListRenderInput<T>): void {
    const availableRows = Math.max(1, Math.trunc(input.availableRows));
    const width = Math.max(1, Math.trunc(input.width));
    const itemWidth = Math.max(1, Math.trunc(input.itemWidth));
    this.#items = input.items;
    this.#selectedIndex = clampIndex(input.selectedIndex, input.items.length);
    this.#regions = [];
    const renderedItems = input.items.map((item) => input.renderItem(item, itemWidth));
    const firstIndex = firstVisibleIndex(
      renderedItems.map((item) => item.lines.length),
      this.#selectedIndex,
      availableRows,
    );
    while (this.#rows.length < availableRows) {
      const row = new TextRenderable(this.#renderer, {
        id: `${this.#idPrefix}-${this.#rows.length}`,
        position: "absolute",
        top: input.top + this.#rows.length,
        left: input.left,
        width: 1,
        height: 1,
        content: "",
        fg: this.#fg,
        bg: this.#bg,
      });
      this.#rows.push(row);
      this.#parent.add(row);
    }

    let rowIndex = 0;
    for (let itemIndex = firstIndex; itemIndex < input.items.length && rowIndex < availableRows; itemIndex += 1) {
      const rendered = renderedItems[itemIndex];
      if (!rendered) {
        continue;
      }
      const selected = itemIndex === this.#selectedIndex;
      let regionStart: ScreenRegion | null = null;
      let regionRowCount = 0;
      for (const [lineIndex, line] of rendered.lines.entries()) {
        if (rowIndex >= availableRows) {
          break;
        }
        const row = this.#rows[rowIndex];
        if (!row) {
          break;
        }
        const prefix = selected && lineIndex === 0 ? "> " : "  ";
        row.top = input.top + rowIndex;
        row.left = input.left;
        row.width = width;
        row.height = 1;
        row.visible = true;
        row.content = this.#formatLine({ line, prefix, width, selected, lineIndex });
        row.fg = selected ? this.#selectedFg : this.#fg;
        row.bg = selected ? this.#selectedBg : this.#bg;
        if (regionStart === null) {
          regionStart = this.#regionMapper.regionForChild(row, { width, rowCount: 1 });
        }
        rowIndex += 1;
        regionRowCount += 1;
      }
      if (regionStart !== null && regionRowCount > 0) {
        this.#regions.push({
          index: itemIndex,
          region: { ...regionStart, rowCount: regionRowCount },
        });
      }
    }

    for (; rowIndex < this.#rows.length; rowIndex += 1) {
      const row = this.#rows[rowIndex];
      if (!row) {
        continue;
      }
      row.top = input.top + rowIndex;
      row.left = input.left;
      row.width = width;
      row.height = 1;
      row.visible = rowIndex < availableRows;
      row.content = "";
      row.fg = this.#fg;
      row.bg = this.#bg;
    }
  }

  handleMouseDown(event: MouseEvent): boolean {
    if (event.button !== MouseButton.LEFT) {
      return false;
    }
    const region = this.#resolveRegion(event);
    if (!region) {
      this.#pressTarget = null;
      return false;
    }
    const item = this.#items[region.index];
    if (!item) {
      return false;
    }
    event.preventDefault();
    this.#selectedIndex = region.index;
    this.#pressTarget = { index: region.index };
    this.#onSelectionChange(region.index, item);
    return true;
  }

  handleMouseUp(event: MouseEvent): boolean {
    if (event.button !== MouseButton.LEFT) {
      this.#pressTarget = null;
      return false;
    }
    const pressTarget = this.#pressTarget;
    this.#pressTarget = null;
    const region = this.#resolveRegion(event);
    if (!pressTarget || !region || pressTarget.index !== region.index) {
      return false;
    }
    const item = this.#items[region.index];
    if (!item) {
      return false;
    }
    event.preventDefault();
    void this.#onConfirm(region.index, item);
    return true;
  }

  resetPointer(): void {
    this.#pressTarget = null;
  }

  #resolveRegion(event: MouseEvent): ItemRegion | null {
    const point = { row: Math.trunc(event.y), col: Math.trunc(event.x) };
    return this.#regions.find((candidate) => screenRegionContains(candidate.region, point)) ?? null;
  }
}

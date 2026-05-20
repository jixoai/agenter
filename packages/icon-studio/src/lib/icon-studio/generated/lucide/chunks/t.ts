import type { LucideIconAssetMap } from "../../../icon-system-contract.js";

export const lucideIconChunk = {
  table: {
    id: "table",
    label: "Table",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "table-2": {
    id: "table-2",
    label: "Table 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "table-cells-merge": {
    id: "table-cells-merge",
    label: "Table Cells Merge",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 21v-6"/><path d="M12 9V3"/><path d="M3 15h18"/><path d="M3 9h18"/><rect width="18" height="18" x="3" y="3" rx="2"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "table-cells-split": {
    id: "table-cells-split",
    label: "Table Cells Split",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 15V9"/><path d="M3 15h18"/><path d="M3 9h18"/><rect width="18" height="18" x="3" y="3" rx="2"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "table-columns-split": {
    id: "table-columns-split",
    label: "Table Columns Split",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 14v2"/><path d="M14 20v2"/><path d="M14 2v2"/><path d="M14 8v2"/><path d="M2 15h8"/><path d="M2 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H2"/><path d="M2 9h8"/><path d="M22 15h-4"/><path d="M22 3h-2a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2"/><path d="M22 9h-4"/><path d="M5 3v18"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "table-of-contents": {
    id: "table-of-contents",
    label: "Table Of Contents",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 5H3"/><path d="M16 12H3"/><path d="M16 19H3"/><path d="M21 5h.01"/><path d="M21 12h.01"/><path d="M21 19h.01"/></g>',
    viewBox: [1.938, 3.938, 20.25, 16.125],
  },
  "table-properties": {
    id: "table-properties",
    label: "Table Properties",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M21 9H3"/><path d="M21 15H3"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "table-rows-split": {
    id: "table-rows-split",
    label: "Table Rows Split",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 10h2"/><path d="M15 22v-8"/><path d="M15 2v4"/><path d="M2 10h2"/><path d="M20 10h2"/><path d="M3 19h18"/><path d="M3 22v-6a2 2 135 0 1 2-2h14a2 2 45 0 1 2 2v6"/><path d="M3 2v2a2 2 45 0 0 2 2h14a2 2 135 0 0 2-2V2"/><path d="M8 10h2"/><path d="M9 22v-8"/><path d="M9 2v4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  tablet: {
    id: "tablet",
    label: "Tablet",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "tablet-smartphone": {
    id: "tablet-smartphone",
    label: "Tablet Smartphone",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="10" height="14" x="3" y="8" rx="2"/><path d="M5 4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-2.4"/><path d="M8 18h.01"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  tablets: {
    id: "tablets",
    label: "Tablets",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="7" cy="7" r="5"/><circle cx="17" cy="17" r="5"/><path d="M12 17h10"/><path d="m3.46 10.54 7.08-7.08"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  tag: {
    id: "tag",
    label: "Tag",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  tags: {
    id: "tags",
    label: "Tags",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z"/><path d="M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193"/><circle cx="10.5" cy="6.5" r=".5" fill="currentColor"/></g>',
    viewBox: [0.938, 0.938, 22.25, 22.125],
  },
  "tally-1": {
    id: "tally-1",
    label: "Tally 1",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 4v16"/></g>',
    viewBox: [2.938, 2.938, 2.125, 18.125],
  },
  "tally-2": {
    id: "tally-2",
    label: "Tally 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 4v16"/><path d="M9 4v16"/></g>',
    viewBox: [2.938, 2.938, 7.125, 18.125],
  },
  "tally-3": {
    id: "tally-3",
    label: "Tally 3",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 4v16"/><path d="M9 4v16"/><path d="M14 4v16"/></g>',
    viewBox: [2.938, 2.938, 12.125, 18.125],
  },
  "tally-4": {
    id: "tally-4",
    label: "Tally 4",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 4v16"/><path d="M9 4v16"/><path d="M14 4v16"/><path d="M19 4v16"/></g>',
    viewBox: [2.938, 2.938, 17.125, 18.125],
  },
  "tally-5": {
    id: "tally-5",
    label: "Tally 5",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 4v16"/><path d="M9 4v16"/><path d="M14 4v16"/><path d="M19 4v16"/><path d="M22 6 2 18"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  tangent: {
    id: "tangent",
    label: "Tangent",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="17" cy="4" r="2"/><path d="M15.59 5.41 5.41 15.59"/><circle cx="4" cy="17" r="2"/><path d="M12 22s-4-9-1.5-11.5S22 12 22 12"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  target: {
    id: "target",
    label: "Target",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  telescope: {
    id: "telescope",
    label: "Telescope",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m10.065 12.493-6.18 1.318a.934.934 0 0 1-1.108-.702l-.537-2.15a1.07 1.07 0 0 1 .691-1.265l13.504-4.44"/><path d="m13.56 11.747 4.332-.924"/><path d="m16 21-3.105-6.21"/><path d="M16.485 5.94a2 2 0 0 1 1.455-2.425l1.09-.272a1 1 0 0 1 1.212.727l1.515 6.06a1 1 0 0 1-.727 1.213l-1.09.272a2 2 0 0 1-2.425-1.455z"/><path d="m6.158 8.633 1.114 4.456"/><path d="m8 21 3.105-6.21"/><circle cx="12" cy="13" r="2"/></g>',
    viewBox: [1.063, 2.063, 21.875, 20],
  },
  tent: {
    id: "tent",
    label: "Tent",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "tent-tree": {
    id: "tent-tree",
    label: "Tent Tree",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="4" cy="4" r="2"/><path d="m14 5 3-3 3 3"/><path d="m14 10 3-3 3 3"/><path d="M17 14V2"/><path d="M17 14H7l-5 8h20Z"/><path d="M8 14v8"/><path d="m9 14 5 8"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  terminal: {
    id: "terminal",
    label: "Terminal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 19h8"/><path d="m4 17 6-6-6-6"/></g>',
    viewBox: [2.938, 3.938, 18.125, 16.125],
  },
  "test-tube": {
    id: "test-tube",
    label: "Test Tube",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14.5 2v17.5c0 1.4-1.1 2.5-2.5 2.5c-1.4 0-2.5-1.1-2.5-2.5V2"/><path d="M8.5 2h7"/><path d="M14.5 16h-5"/></g>',
    viewBox: [7.438, 0.938, 9.125, 22.125],
  },
  "test-tube-diagonal": {
    id: "test-tube-diagonal",
    label: "Test Tube Diagonal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 7 6.82 21.18a2.83 2.83 0 0 1-3.99-.01a2.83 2.83 0 0 1 0-4L17 3"/><path d="m16 2 6 6"/><path d="M12 16H4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "test-tubes": {
    id: "test-tubes",
    label: "Test Tubes",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 2v17.5A2.5 2.5 0 0 1 6.5 22A2.5 2.5 0 0 1 4 19.5V2"/><path d="M20 2v17.5a2.5 2.5 0 0 1-2.5 2.5a2.5 2.5 0 0 1-2.5-2.5V2"/><path d="M3 2h7"/><path d="M14 2h7"/><path d="M9 16H4"/><path d="M20 16h-5"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "text-align-center": {
    id: "text-align-center",
    label: "Text Align Center",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H3"/><path d="M17 12H7"/><path d="M19 19H5"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "text-align-end": {
    id: "text-align-end",
    label: "Text Align End",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H3"/><path d="M21 12H9"/><path d="M21 19H7"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "text-align-justify": {
    id: "text-align-justify",
    label: "Text Align Justify",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 5h18"/><path d="M3 12h18"/><path d="M3 19h18"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "text-align-start": {
    id: "text-align-start",
    label: "Text Align Start",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H3"/><path d="M15 12H3"/><path d="M17 19H3"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "text-cursor": {
    id: "text-cursor",
    label: "Text Cursor",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M17 22h-1a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4h1"/><path d="M7 22h1a4 4 0 0 0 4-4v-1"/><path d="M7 2h1a4 4 0 0 1 4 4v1"/></g>',
    viewBox: [5.938, 0.938, 12.125, 22.125],
  },
  "text-cursor-input": {
    id: "text-cursor-input",
    label: "Text Cursor Input",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 20h-1a2 2 0 0 1-2-2 2 2 0 0 1-2 2H6"/><path d="M13 8h7a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-7"/><path d="M5 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h1"/><path d="M6 4h1a2 2 0 0 1 2 2 2 2 0 0 1 2-2h1"/><path d="M9 6v12"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  "text-initial": {
    id: "text-initial",
    label: "Text Initial",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 5h6"/><path d="M15 12h6"/><path d="M3 19h18"/><path d="m3 12 3.553-7.724a.5.5 0 0 1 .894 0L11 12"/><path d="M3.92 10h6.16"/></g>',
    viewBox: [1.938, 2.938, 20.125, 17.125],
  },
  "text-quote": {
    id: "text-quote",
    label: "Text Quote",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M17 5H3"/><path d="M21 12H8"/><path d="M21 19H8"/><path d="M3 12v7"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "text-search": {
    id: "text-search",
    label: "Text Search",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H3"/><path d="M10 12H3"/><path d="M10 19H3"/><circle cx="17" cy="15" r="3"/><path d="m21 19-1.9-1.9"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "text-select": {
    id: "text-select",
    label: "Text Select",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 21h1"/><path d="M14 3h1"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M21 14v1"/><path d="M21 19a2 2 0 0 1-2 2"/><path d="M21 9v1"/><path d="M3 14v1"/><path d="M3 9v1"/><path d="M5 21a2 2 0 0 1-2-2"/><path d="M5 3a2 2 0 0 0-2 2"/><path d="M7 12h10"/><path d="M7 16h6"/><path d="M7 8h8"/><path d="M9 21h1"/><path d="M9 3h1"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "text-wrap": {
    id: "text-wrap",
    label: "Text Wrap",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16 16-3 3 3 3"/><path d="M3 12h14.5a1 1 0 0 1 0 7H13"/><path d="M3 19h6"/><path d="M3 5h18"/></g>',
    viewBox: [1.938, 3.938, 20.125, 19.125],
  },
  theater: {
    id: "theater",
    label: "Theater",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 10s3-3 3-8"/><path d="M22 10s-3-3-3-8"/><path d="M10 2c0 4.4-3.6 8-8 8"/><path d="M14 2c0 4.4 3.6 8 8 8"/><path d="M2 10s2 2 2 5"/><path d="M22 10s-2 2-2 5"/><path d="M8 15h8"/><path d="M2 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/><path d="M14 22v-1a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  thermometer: {
    id: "thermometer",
    label: "Thermometer",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z"/></g>',
    viewBox: [6.938, 0.938, 10.125, 22.125],
  },
  "thermometer-snowflake": {
    id: "thermometer-snowflake",
    label: "Thermometer Snowflake",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m10 20-1.25-2.5L6 18"/><path d="M10 4 8.75 6.5 6 6"/><path d="M10.585 15H10"/><path d="M2 12h6.5L10 9"/><path d="M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="m4 10 1.5 2L4 14"/><path d="m7 21 3-6-1.5-3"/><path d="m7 3 3 6h2"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "thermometer-sun": {
    id: "thermometer-sun",
    label: "Thermometer Sun",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 2v2"/><path d="M12 8a4 4 0 0 0-1.645 7.647"/><path d="M2 12h2"/><path d="M20 14.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/><path d="m4.93 4.93 1.41 1.41"/><path d="m6.34 17.66-1.41 1.41"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "thumbs-down": {
    id: "thumbs-down",
    label: "Thumbs Down",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z"/><path d="M17 14V2"/></g>',
    viewBox: [1.063, 0.938, 22, 22.125],
  },
  "thumbs-up": {
    id: "thumbs-up",
    label: "Thumbs Up",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/><path d="M7 10v12"/></g>',
    viewBox: [0.938, 0.938, 22, 22.125],
  },
  ticket: {
    id: "ticket",
    label: "Ticket",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "ticket-check": {
    id: "ticket-check",
    label: "Ticket Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="m9 12 2 2 4-4"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "ticket-minus": {
    id: "ticket-minus",
    label: "Ticket Minus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M9 12h6"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "ticket-percent": {
    id: "ticket-percent",
    label: "Ticket Percent",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 9a3 3 0 1 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 1 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M9 9h.01"/><path d="m15 9-6 6"/><path d="M15 15h.01"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "ticket-plus": {
    id: "ticket-plus",
    label: "Ticket Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M9 12h6"/><path d="M12 9v6"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "ticket-slash": {
    id: "ticket-slash",
    label: "Ticket Slash",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="m9.5 14.5 5-5"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "ticket-x": {
    id: "ticket-x",
    label: "Ticket X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="m9.5 14.5 5-5"/><path d="m9.5 9.5 5 5"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  tickets: {
    id: "tickets",
    label: "Tickets",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m3.173 8.18 11-5a2 2 0 0 1 2.647.993L18.56 8"/><path d="M6 10V8"/><path d="M6 14v1"/><path d="M6 19v2"/><rect x="2" y="8" width="20" height="13" rx="2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "tickets-plane": {
    id: "tickets-plane",
    label: "Tickets Plane",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10.5 17h1.227a2 2 0 0 0 1.345-.52L18 12"/><path d="m12 13.5 3.794.506"/><path d="m3.173 8.18 11-5a2 2 0 0 1 2.647.993L18.56 8"/><path d="M6 10V8"/><path d="M6 14v1"/><path d="M6 19v2"/><rect x="2" y="8" width="20" height="13" rx="2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  timer: {
    id: "timer",
    label: "Timer",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><line x1="10" x2="14" y1="2" y2="2"/><line x1="12" x2="15" y1="14" y2="11"/><circle cx="12" cy="14" r="8"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "timer-off": {
    id: "timer-off",
    label: "Timer Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 2h4"/><path d="M4.6 11a8 8 0 0 0 1.7 8.7 8 8 0 0 0 8.7 1.7"/><path d="M7.4 7.4a8 8 0 0 1 10.3 1 8 8 0 0 1 .9 10.2"/><path d="m2 2 20 20"/><path d="M12 12v-2"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.25],
  },
  "timer-reset": {
    id: "timer-reset",
    label: "Timer Reset",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 2h4"/><path d="M12 14v-4"/><path d="M4 13a8 8 0 0 1 8-7 8 8 0 1 1-5.3 14L4 17.6"/><path d="M9 17H4v5"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "toggle-left": {
    id: "toggle-left",
    label: "Toggle Left",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="9" cy="12" r="3"/><rect width="20" height="14" x="2" y="5" rx="7"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "toggle-right": {
    id: "toggle-right",
    label: "Toggle Right",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="15" cy="12" r="3"/><rect width="20" height="14" x="2" y="5" rx="7"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  toilet: {
    id: "toilet",
    label: "Toilet",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 12h13a1 1 0 0 1 1 1 5 5 0 0 1-5 5h-.598a.5.5 0 0 0-.424.765l1.544 2.47a.5.5 0 0 1-.424.765H5.402a.5.5 0 0 1-.424-.765L7 18"/><path d="M8 18a5 5 0 0 1-5-5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "tool-case": {
    id: "tool-case",
    label: "Tool Case",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 15h4"/><path d="m14.817 10.995-.971-1.45 1.034-1.232a2 2 0 0 0-2.025-3.238l-1.82.364L9.91 3.885a2 2 0 0 0-3.625.748L6.141 6.55l-1.725.426a2 2 0 0 0-.19 3.756l.657.27"/><path d="m18.822 10.995 2.26-5.38a1 1 0 0 0-.557-1.318L16.954 2.9a1 1 0 0 0-1.281.533l-.924 2.122"/><path d="M4 12.006A1 1 0 0 1 4.994 11H19a1 1 0 0 1 1 1v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/></g>',
    viewBox: [1.938, 1.688, 20.375, 20.375],
  },
  toolbox: {
    id: "toolbox",
    label: "Toolbox",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 12v4"/><path d="M16 6a2 2 0 0 1 1.414.586l4 4A2 2 0 0 1 22 12v7a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 .586-1.414l4-4A2 2 0 0 1 8 6z"/><path d="M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 14h20"/><path d="M8 12v4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 21.125],
  },
  tornado: {
    id: "tornado",
    label: "Tornado",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 4H3"/><path d="M18 8H6"/><path d="M19 12H9"/><path d="M16 16h-6"/><path d="M11 20H9"/></g>',
    viewBox: [1.938, 2.938, 20.125, 18.125],
  },
  torus: {
    id: "torus",
    label: "Torus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><ellipse cx="12" cy="11" rx="3" ry="2"/><ellipse cx="12" cy="12.5" rx="10" ry="8.5"/></g>',
    viewBox: [0.938, 2.938, 22.125, 19.125],
  },
  touchpad: {
    id: "touchpad",
    label: "Touchpad",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M2 14h20"/><path d="M12 20v-6"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  "touchpad-off": {
    id: "touchpad-off",
    label: "Touchpad Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 20v-6"/><path d="M19.656 14H22"/><path d="M2 14h12"/><path d="m2 2 20 20"/><path d="M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2"/><path d="M9.656 4H20a2 2 0 0 1 2 2v10.344"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "towel-rack": {
    id: "towel-rack",
    label: "Towel Rack",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 7h-2"/><path d="M6.5 3h11A2.5 2.5 0 0 1 20 5.5V20a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1V5.5a1 1 0 0 0-5 0V17a1 1 0 0 0 1 1h4"/><path d="M9 7H2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "tower-control": {
    id: "tower-control",
    label: "Tower Control",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18.2 12.27 20 6H4l1.8 6.27a1 1 0 0 0 .95.73h10.5a1 1 0 0 0 .96-.73Z"/><path d="M8 13v9"/><path d="M16 22v-9"/><path d="m9 6 1 7"/><path d="m15 6-1 7"/><path d="M12 6V2"/><path d="M13 2h-2"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "toy-brick": {
    id: "toy-brick",
    label: "Toy Brick",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="12" x="3" y="8" rx="1"/><path d="M10 8V5c0-.6-.4-1-1-1H6a1 1 0 0 0-1 1v3"/><path d="M19 8V5c0-.6-.4-1-1-1h-3a1 1 0 0 0-1 1v3"/></g>',
    viewBox: [1.938, 2.938, 20.125, 18.125],
  },
  tractor: {
    id: "tractor",
    label: "Tractor",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M7 15h.01"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/></g>',
    viewBox: [0.938, 2.938, 22, 18.125],
  },
  "traffic-cone": {
    id: "traffic-cone",
    label: "Traffic Cone",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16.05 10.966a5 2.5 0 0 1-8.1 0"/><path d="m16.923 14.049 4.48 2.04a1 1 0 0 1 .001 1.831l-8.574 3.9a2 2 0 0 1-1.66 0l-8.574-3.91a1 1 0 0 1 0-1.83l4.484-2.04"/><path d="M16.949 14.14a5 2.5 0 1 1-9.9 0L10.063 3.5a2 2 0 0 1 3.874 0z"/><path d="M9.194 6.57a5 2.5 0 0 0 5.61 0"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "train-front": {
    id: "train-front",
    label: "Train Front",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/><path d="m9 15-1-1"/><path d="m15 15 1-1"/><path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/><path d="m8 19-2 3"/><path d="m16 19 2 3"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "train-front-tunnel": {
    id: "train-front-tunnel",
    label: "Train Front Tunnel",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 22V12a10 10 0 1 1 20 0v10"/><path d="M15 6.8v1.4a3 2.8 0 1 1-6 0V6.8"/><path d="M10 15h.01"/><path d="M14 15h.01"/><path d="M10 19a4 4 0 0 1-4-4v-3a6 6 0 1 1 12 0v3a4 4 0 0 1-4 4Z"/><path d="m9 19-2 3"/><path d="m15 19 2 3"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "train-track": {
    id: "train-track",
    label: "Train Track",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 17 17 2"/><path d="m2 14 8 8"/><path d="m5 11 8 8"/><path d="m8 8 8 8"/><path d="m11 5 8 8"/><path d="m14 2 8 8"/><path d="M7 22 22 7"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "tram-front": {
    id: "tram-front",
    label: "Tram Front",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/></g>',
    viewBox: [2.938, 1.938, 18.125, 21.125],
  },
  transgender: {
    id: "transgender",
    label: "Transgender",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 16v6"/><path d="M14 20h-4"/><path d="M18 2h4v4"/><path d="m2 2 7.17 7.17"/><path d="M2 5.355V2h3.357"/><path d="m22 2-7.17 7.17"/><path d="M8 5 5 8"/><circle cx="12" cy="12" r="4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  trash: {
    id: "trash",
    label: "Trash",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "trash-2": {
    id: "trash-2",
    label: "Trash 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "tree-deciduous": {
    id: "tree-deciduous",
    label: "Tree Deciduous",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 19a4 4 0 0 1-2.24-7.32A3.5 3.5 0 0 1 9 6.03V6a3 3 0 1 1 6 0v.04a3.5 3.5 0 0 1 3.24 5.65A4 4 0 0 1 16 19Z"/><path d="M12 19v3"/></g>',
    viewBox: [2.813, 1.938, 18.25, 21.125],
  },
  "tree-palm": {
    id: "tree-palm",
    label: "Tree Palm",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13 8c0-2.76-2.46-5-5.5-5S2 5.24 2 8h2l1-1 1 1h4"/><path d="M13 7.14A5.82 5.82 0 0 1 16.5 6c3.04 0 5.5 2.24 5.5 5h-3l-1-1-1 1h-3"/><path d="M5.89 9.71c-2.15 2.15-2.3 5.47-.35 7.43l4.24-4.25.7-.7.71-.71 2.12-2.12c-1.95-1.96-5.27-1.8-7.42.35"/><path d="M11 15.5c.5 2.5-.17 4.5-1 6.5h4c2-5.5-.5-12-1-14"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "tree-pine": {
    id: "tree-pine",
    label: "Tree Pine",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/></g>',
    viewBox: [2.563, 1.938, 18.875, 21.125],
  },
  trees: {
    id: "trees",
    label: "Trees",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/></g>',
    viewBox: [0.938, 1.938, 21.5, 21.125],
  },
  "trending-down": {
    id: "trending-down",
    label: "Trending Down",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/></g>',
    viewBox: [0.938, 5.938, 22.125, 12.125],
  },
  "trending-up": {
    id: "trending-up",
    label: "Trending Up",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/></g>',
    viewBox: [0.938, 5.938, 22.125, 12.125],
  },
  "trending-up-down": {
    id: "trending-up-down",
    label: "Trending Up Down",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14.828 14.828 21 21"/><path d="M21 16v5h-5"/><path d="m21 3-9 9-4-4-6 6"/><path d="M21 8V3h-5"/></g>',
    viewBox: [0.938, 1.938, 21.125, 20.125],
  },
  triangle: {
    id: "triangle",
    label: "Triangle",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13.73 4a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "triangle-alert": {
    id: "triangle-alert",
    label: "Triangle Alert",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></g>',
    viewBox: [0.813, 1.813, 22.25, 20.25],
  },
  "triangle-dashed": {
    id: "triangle-dashed",
    label: "Triangle Dashed",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10.17 4.193a2 2 0 0 1 3.666.013"/><path d="M14 21h2"/><path d="m15.874 7.743 1 1.732"/><path d="m18.849 12.952 1 1.732"/><path d="M21.824 18.18a2 2 0 0 1-1.835 2.824"/><path d="M4.024 21a2 2 0 0 1-1.839-2.839"/><path d="m5.136 12.952-1 1.732"/><path d="M8 21h2"/><path d="m8.102 7.743-1 1.732"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "triangle-right": {
    id: "triangle-right",
    label: "Triangle Right",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 18a2 2 0 0 1-2 2H3c-1.1 0-1.3-.6-.4-1.3L20.4 4.3c.9-.7 1.6-.4 1.6.7Z"/></g>',
    viewBox: [0.938, 2.813, 22.125, 18.25],
  },
  trophy: {
    id: "trophy",
    label: "Trophy",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  truck: {
    id: "truck",
    label: "Truck",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  "truck-electric": {
    id: "truck-electric",
    label: "Truck Electric",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 19V7a2 2 0 0 0-2-2H9"/><path d="M15 19H9"/><path d="M19 19h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62L18.3 9.38a1 1 0 0 0-.78-.38H14"/><path d="M2 13v5a1 1 0 0 0 1 1h2"/><path d="M4 3 2.15 5.15a.495.495 0 0 0 .35.86h2.15a.47.47 0 0 1 .35.86L3 9.02"/><circle cx="17" cy="19" r="2"/><circle cx="7" cy="19" r="2"/></g>',
    viewBox: [0.813, 1.938, 22.25, 20.125],
  },
  "turkish-lira": {
    id: "turkish-lira",
    label: "Turkish Lira",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 4 5 9"/><path d="m15 8.5-10 5"/><path d="M18 12a9 9 0 0 1-9 9V3"/></g>',
    viewBox: [3.938, 1.938, 15.125, 20.125],
  },
  turntable: {
    id: "turntable",
    label: "Turntable",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 12.01h.01"/><path d="M18 8v4a8 8 0 0 1-1.07 4"/><circle cx="10" cy="12" r="4"/><rect x="2" y="4" width="20" height="16" rx="2"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  turtle: {
    id: "turtle",
    label: "Turtle",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m12 10 2 4v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3a8 8 0 1 0-16 0v3a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-3l2-4h4Z"/><path d="M4.82 7.9 8 10"/><path d="M15.18 7.9 12 10"/><path d="M16.93 10H20a2 2 0 0 1 0 4H2"/></g>',
    viewBox: [0.938, 4.938, 22.125, 14.125],
  },
  tv: {
    id: "tv",
    label: "Tv",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m17 2-5 5-5-5"/><rect width="20" height="15" x="2" y="7" rx="2"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "tv-minimal": {
    id: "tv-minimal",
    label: "Tv Minimal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 21h10"/><rect width="20" height="14" x="2" y="3" rx="2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "tv-minimal-play": {
    id: "tv-minimal-play",
    label: "Tv Minimal Play",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z"/><path d="M7 21h10"/><rect width="20" height="14" x="2" y="3" rx="2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  type: {
    id: "type",
    label: "Type",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 4v16"/><path d="M4 7V5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v2"/><path d="M9 20h6"/></g>',
    viewBox: [2.938, 2.938, 18.125, 18.125],
  },
  "type-outline": {
    id: "type-outline",
    label: "Type Outline",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 16.5a.5.5 0 0 0 .5.5h.5a2 2 0 0 1 0 4H9a2 2 0 0 1 0-4h.5a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5V8a2 2 0 0 1-4 0V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-4 0v-.5a.5.5 0 0 0-.5-.5h-3a.5.5 0 0 0-.5.5Z"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
} satisfies LucideIconAssetMap;

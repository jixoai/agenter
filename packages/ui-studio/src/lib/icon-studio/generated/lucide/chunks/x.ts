import type { LucideIconAssetMap } from "../../../icon-system-contract.js";

export const lucideIconChunk = {
  x: {
    id: "x",
    label: "X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></g>',
    viewBox: [4.938, 4.938, 14.125, 14.125],
  },
  "x-line-top": {
    id: "x-line-top",
    label: "X Line Top",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 4H6"/><path d="M18 8 6 20"/><path d="m6 8 12 12"/></g>',
    viewBox: [4.938, 2.938, 14.125, 18.125],
  },
} satisfies LucideIconAssetMap;

import type { LucideIconAssetMap } from "../../../icon-system-contract.js";

export const lucideIconChunk = {
  "japanese-yen": {
    id: "japanese-yen",
    label: "Japanese Yen",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 9.5V21m0-11.5L6 3m6 6.5L18 3"/><path d="M6 15h12"/><path d="M6 11h12"/></g>',
    viewBox: [4.938, 1.938, 14.125, 20.125],
  },
  joystick: {
    id: "joystick",
    label: "Joystick",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 17a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2Z"/><path d="M6 15v-2"/><path d="M12 15V9"/><circle cx="12" cy="6" r="3"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
} satisfies LucideIconAssetMap;

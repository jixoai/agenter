import type { LucideIconAssetMap } from "../../../icon-system-contract.js";

export const lucideIconChunk = {
  magnet: {
    id: "magnet",
    label: "Magnet",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m12 15 4 4"/><path d="M2.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.029-6.029a1 1 0 1 1 3 3l-6.029 6.029a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l6.365-6.367A1 1 0 0 0 8.716 4.282z"/><path d="m5 8 4 4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  mail: {
    id: "mail",
    label: "Mail",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"/><rect x="2" y="4" width="20" height="16" rx="2"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  "mail-check": {
    id: "mail-check",
    label: "Mail Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m16 19 2 2 4-4"/></g>',
    viewBox: [0.938, 2.938, 22.125, 19.125],
  },
  "mail-minus": {
    id: "mail-minus",
    label: "Mail Minus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 15V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="M16 19h6"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  "mail-open": {
    id: "mail-open",
    label: "Mail Open",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21.2 8.4c.5.38.8.97.8 1.6v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V10a2 2 0 0 1 .8-1.6l8-6a2 2 0 0 1 2.4 0l8 6Z"/><path d="m22 10-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 10"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "mail-plus": {
    id: "mail-plus",
    label: "Mail Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h8"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="M19 16v6"/><path d="M16 19h6"/></g>',
    viewBox: [0.938, 2.938, 22.125, 20.125],
  },
  "mail-question-mark": {
    id: "mail-question-mark",
    label: "Mail Question Mark",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="M18 15.28c.2-.4.5-.8.9-1a2.1 2.1 0 0 1 2.6.4c.3.4.5.8.5 1.3 0 1.3-2 2-2 2"/><path d="M20 22v.01"/></g>',
    viewBox: [0.938, 2.938, 22.125, 20.25],
  },
  "mail-search": {
    id: "mail-search",
    label: "Mail Search",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 12.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h7.5"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><circle cx="18" cy="18" r="3"/><path d="m22 22-1.5-1.5"/></g>',
    viewBox: [0.938, 2.938, 22.125, 20.125],
  },
  "mail-warning": {
    id: "mail-warning",
    label: "Mail Warning",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 10.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h12.5"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="M20 14v4"/><path d="M20 22v.01"/></g>',
    viewBox: [0.938, 2.938, 22.125, 20.25],
  },
  "mail-x": {
    id: "mail-x",
    label: "Mail X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/><path d="m17 17 4 4"/><path d="m21 17-4 4"/></g>',
    viewBox: [0.938, 2.938, 22.125, 19.125],
  },
  mailbox: {
    id: "mailbox",
    label: "Mailbox",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9.5C2 7 4 5 6.5 5H18c2.2 0 4 1.8 4 4v8Z"/><polyline points="15,9 18,9 18,11"/><path d="M6.5 5C9 5 11 7 11 9.5V17a2 2 0 0 1-2 2"/><line x1="6" x2="7" y1="10" y2="10"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  mails: {
    id: "mails",
    label: "Mails",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M17 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 1-1.732"/><path d="m22 5.5-6.419 4.179a2 2 0 0 1-2.162 0L7 5.5"/><rect x="7" y="3" width="15" height="12" rx="2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  map: {
    id: "map",
    label: "Map",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></g>',
    viewBox: [1.938, 2.063, 20.125, 19.875],
  },
  "map-minus": {
    id: "map-minus",
    label: "Map Minus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m11 19-1.106-.552a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0l4.212 2.106a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619V14"/><path d="M15 5.764V14"/><path d="M21 18h-6"/><path d="M9 3.236v15"/></g>',
    viewBox: [1.938, 2.063, 20.125, 19.5],
  },
  "map-pin": {
    id: "map-pin",
    label: "Map Pin",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "map-pin-check": {
    id: "map-pin-check",
    label: "Map Pin Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19.43 12.935c.357-.967.57-1.955.57-2.935a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32.197 32.197 0 0 0 .813-.728"/><circle cx="12" cy="10" r="3"/><path d="m16 18 2 2 4-4"/></g>',
    viewBox: [2.938, 0.938, 20.125, 22.125],
  },
  "map-pin-check-inside": {
    id: "map-pin-check-inside",
    label: "Map Pin Check Inside",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><path d="m9 10 2 2 4-4"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "map-pin-house": {
    id: "map-pin-house",
    label: "Map Pin House",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z"/><path d="M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2"/><path d="M18 22v-3"/><circle cx="10" cy="10" r="3"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "map-pin-minus": {
    id: "map-pin-minus",
    label: "Map Pin Minus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18.977 14C19.6 12.701 20 11.343 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738"/><circle cx="12" cy="10" r="3"/><path d="M16 18h6"/></g>',
    viewBox: [2.938, 0.938, 20.125, 22.125],
  },
  "map-pin-minus-inside": {
    id: "map-pin-minus-inside",
    label: "Map Pin Minus Inside",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><path d="M9 10h6"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "map-pin-off": {
    id: "map-pin-off",
    label: "Map Pin Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12.75 7.09a3 3 0 0 1 2.16 2.16"/><path d="M17.072 17.072c-1.634 2.17-3.527 3.912-4.471 4.727a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 1.432-4.568"/><path d="m2 2 20 20"/><path d="M8.475 2.818A8 8 0 0 1 20 10c0 1.183-.31 2.377-.81 3.533"/><path d="M9.13 9.13a3 3 0 0 0 3.74 3.74"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "map-pin-pen": {
    id: "map-pin-pen",
    label: "Map Pin Pen",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M17.97 9.304A8 8 0 0 0 2 10c0 4.69 4.887 9.562 7.022 11.468"/><path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/><circle cx="10" cy="10" r="3"/></g>',
    viewBox: [0.938, 0.813, 22.125, 22.25],
  },
  "map-pin-plus": {
    id: "map-pin-plus",
    label: "Map Pin Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19.914 11.105A7.298 7.298 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 32 32 0 0 0 .824-.738"/><circle cx="12" cy="10" r="3"/><path d="M16 18h6"/><path d="M19 15v6"/></g>',
    viewBox: [2.938, 0.938, 20.125, 22.125],
  },
  "map-pin-plus-inside": {
    id: "map-pin-plus-inside",
    label: "Map Pin Plus Inside",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><path d="M12 7v6"/><path d="M9 10h6"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "map-pin-search": {
    id: "map-pin-search",
    label: "Map Pin Search",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M 12.248 21.969 a 1 1 0 0 1 -0.849 -0.17 C 9.539 20.193 4 14.993 4 10 a 8 8 0 0 1 16 0 C 20 10.42 19.961 10.841 19.888 11.262"/><path d="m22 22-1.88-1.88"/><circle cx="12" cy="10" r="3"/><circle cx="18" cy="18" r="3"/></g>',
    viewBox: [2.938, 0.938, 20.125, 22.125],
  },
  "map-pin-x": {
    id: "map-pin-x",
    label: "Map Pin X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19.752 11.901A7.78 7.78 0 0 0 20 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 1.202 0 19 19 0 0 0 .09-.077"/><circle cx="12" cy="10" r="3"/><path d="m21.5 15.5-5 5"/><path d="m21.5 20.5-5-5"/></g>',
    viewBox: [2.938, 0.938, 19.625, 22.125],
  },
  "map-pin-x-inside": {
    id: "map-pin-x-inside",
    label: "Map Pin X Inside",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><path d="m14.5 7.5-5 5"/><path d="m9.5 7.5 5 5"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "map-pinned": {
    id: "map-pinned",
    label: "Map Pinned",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0"/><circle cx="12" cy="8" r="2"/><path d="M8.714 14h-3.71a1 1 0 0 0-.948.683l-2.004 6A1 1 0 0 0 3 22h18a1 1 0 0 0 .948-1.316l-2-6a1 1 0 0 0-.949-.684h-3.712"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "map-plus": {
    id: "map-plus",
    label: "Map Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m11 19-1.106-.552a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0l4.212 2.106a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619V12"/><path d="M15 5.764V12"/><path d="M18 15v6"/><path d="M21 18h-6"/><path d="M9 3.236v15"/></g>',
    viewBox: [1.938, 2.063, 20.125, 20],
  },
  mars: {
    id: "mars",
    label: "Mars",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 3h5v5"/><path d="m21 3-6.75 6.75"/><circle cx="10" cy="14" r="6"/></g>',
    viewBox: [2.938, 1.938, 19.125, 19.125],
  },
  "mars-stroke": {
    id: "mars-stroke",
    label: "Mars Stroke",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m14 6 4 4"/><path d="M17 3h4v4"/><path d="m21 3-7.75 7.75"/><circle cx="9" cy="15" r="6"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  martini: {
    id: "martini",
    label: "Martini",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></g>',
    viewBox: [3.938, 1.938, 16.125, 21.125],
  },
  maximize: {
    id: "maximize",
    label: "Maximize",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "maximize-2": {
    id: "maximize-2",
    label: "Maximize 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 3h6v6"/><path d="m21 3-7 7"/><path d="m3 21 7-7"/><path d="M9 21H3v-6"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  medal: {
    id: "medal",
    label: "Medal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></g>',
    viewBox: [1.313, 0.938, 21.375, 22.125],
  },
  megaphone: {
    id: "megaphone",
    label: "Megaphone",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 6v8"/></g>',
    viewBox: [1.938, 1.938, 20.125, 21.125],
  },
  "megaphone-off": {
    id: "megaphone-off",
    label: "Megaphone Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11.636 6A13 13 0 0 0 19.4 3.2 1 1 0 0 1 21 4v11.344"/><path d="M14.378 14.357A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1"/><path d="m2 2 20 20"/><path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/><path d="M8 8v6"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  meh: {
    id: "meh",
    label: "Meh",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" x2="16" y1="15" y2="15"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "memory-stick": {
    id: "memory-stick",
    label: "Memory Stick",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 12v-2"/><path d="M12 18v-2"/><path d="M16 12v-2"/><path d="M16 18v-2"/><path d="M2 11h1.5"/><path d="M20 18v-2"/><path d="M20.5 11H22"/><path d="M4 18v-2"/><path d="M8 12v-2"/><path d="M8 18v-2"/><rect x="2" y="6" width="20" height="10" rx="2"/></g>',
    viewBox: [0.938, 4.938, 22.125, 14.125],
  },
  menu: {
    id: "menu",
    label: "Menu",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h16"/></g>',
    viewBox: [2.938, 3.938, 18.125, 16.125],
  },
  merge: {
    id: "merge",
    label: "Merge",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m8 6 4-4 4 4"/><path d="M12 2v10.3a4 4 0 0 1-1.172 2.872L4 22"/><path d="m20 22-5-5"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "message-circle": {
    id: "message-circle",
    label: "Message Circle",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-check": {
    id: "message-circle-check",
    label: "Message Circle Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="m9 12 2 2 4-4"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-code": {
    id: "message-circle-code",
    label: "Message Circle Code",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m10 9-3 3 3 3"/><path d="m14 15 3-3-3-3"/><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-dashed": {
    id: "message-circle-dashed",
    label: "Message Circle Dashed",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10.1 2.182a10 10 0 0 1 3.8 0"/><path d="M13.9 21.818a10 10 0 0 1-3.8 0"/><path d="M17.609 3.72a10 10 0 0 1 2.69 2.7"/><path d="M2.182 13.9a10 10 0 0 1 0-3.8"/><path d="M20.28 17.61a10 10 0 0 1-2.7 2.69"/><path d="M21.818 10.1a10 10 0 0 1 0 3.8"/><path d="M3.721 6.391a10 10 0 0 1 2.7-2.69"/><path d="m6.163 21.117-2.906.85a1 1 0 0 1-1.236-1.169l.965-2.98"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "message-circle-heart": {
    id: "message-circle-heart",
    label: "Message Circle Heart",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M7.828 13.07A3 3 0 0 1 12 8.764a3 3 0 0 1 5.004 2.224 3 3 0 0 1-.832 2.083l-3.447 3.62a1 1 0 0 1-1.45-.001z"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-more": {
    id: "message-circle-more",
    label: "Message Circle More",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-off": {
    id: "message-circle-off",
    label: "Message Circle Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m2 2 20 20"/><path d="M4.93 4.929a10 10 0 0 0-1.938 11.412 2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 0 0 11.302-1.989"/><path d="M8.35 2.69A10 10 0 0 1 21.3 15.65"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "message-circle-plus": {
    id: "message-circle-plus",
    label: "Message Circle Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M8 12h8"/><path d="M12 8v8"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-question-mark": {
    id: "message-circle-question-mark",
    label: "Message Circle Question Mark",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-reply": {
    id: "message-circle-reply",
    label: "Message Circle Reply",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="m10 15-3-3 3-3"/><path d="M7 12h8a2 2 0 0 1 2 2v1"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-warning": {
    id: "message-circle-warning",
    label: "Message Circle Warning",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M12 8v4"/><path d="M12 16h.01"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-circle-x": {
    id: "message-circle-x",
    label: "Message Circle X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "message-square": {
    id: "message-square",
    label: "Message Square",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-check": {
    id: "message-square-check",
    label: "Message Square Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.7.7 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="m9 11 2 2 4-4"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.25],
  },
  "message-square-code": {
    id: "message-square-code",
    label: "Message Square Code",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="m10 8-3 3 3 3"/><path d="m14 14 3-3-3-3"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-dashed": {
    id: "message-square-dashed",
    label: "Message Square Dashed",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 3h2"/><path d="M16 19h-2"/><path d="M2 12v-2"/><path d="M2 16v5.286a.71.71 0 0 0 1.212.502l1.149-1.149"/><path d="M20 19a2 2 0 0 0 2-2v-1"/><path d="M22 10v2"/><path d="M22 6V5a2 2 0 0 0-2-2"/><path d="M4 3a2 2 0 0 0-2 2v1"/><path d="M8 19h2"/><path d="M8 3h2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-diff": {
    id: "message-square-diff",
    label: "Message Square Diff",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M10 15h4"/><path d="M10 9h4"/><path d="M12 7v4"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-dot": {
    id: "message-square-dot",
    label: "Message Square Dot",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12.7 3H4a2 2 0 0 0-2 2v16.286a.71.71 0 0 0 1.212.502l2.202-2.202A2 2 0 0 1 6.828 19H20a2 2 0 0 0 2-2v-4.7"/><circle cx="19" cy="6" r="3"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-heart": {
    id: "message-square-heart",
    label: "Message Square Heart",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M7.5 9.5c0 .687.265 1.383.697 1.844l3.009 3.264a1.14 1.14 0 0 0 .407.314 1 1 0 0 0 .783-.004 1.14 1.14 0 0 0 .398-.31l3.008-3.264A2.77 2.77 0 0 0 16.5 9.5 2.5 2.5 0 0 0 12 8a2.5 2.5 0 0 0-4.5 1.5"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-lock": {
    id: "message-square-lock",
    label: "Message Square Lock",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 8.5V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v16.286a.71.71 0 0 0 1.212.502l2.202-2.202A2 2 0 0 1 6.828 19H10"/><path d="M20 15v-2a2 2 0 0 0-4 0v2"/><rect x="14" y="15" width="8" height="5" rx="1"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-more": {
    id: "message-square-more",
    label: "Message Square More",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 11h.01"/><path d="M16 11h.01"/><path d="M8 11h.01"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-off": {
    id: "message-square-off",
    label: "Message Square Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19 19H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.7.7 0 0 1 2 21.286V5a2 2 0 0 1 1.184-1.826"/><path d="m2 2 20 20"/><path d="M8.656 3H20a2 2 0 0 1 2 2v11.344"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.25],
  },
  "message-square-plus": {
    id: "message-square-plus",
    label: "Message Square Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 8v6"/><path d="M9 11h6"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-quote": {
    id: "message-square-quote",
    label: "Message Square Quote",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 14a2 2 0 0 0 2-2V8h-2"/><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M8 14a2 2 0 0 0 2-2V8H8"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-reply": {
    id: "message-square-reply",
    label: "Message Square Reply",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="m10 8-3 3 3 3"/><path d="M17 14v-1a2 2 0 0 0-2-2H7"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-share": {
    id: "message-square-share",
    label: "Message Square Share",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 3H4a2 2 0 0 0-2 2v16.286a.71.71 0 0 0 1.212.502l2.202-2.202A2 2 0 0 1 6.828 19H20a2 2 0 0 0 2-2v-4"/><path d="M16 3h6v6"/><path d="m16 9 6-6"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-text": {
    id: "message-square-text",
    label: "Message Square Text",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M7 11h10"/><path d="M7 15h6"/><path d="M7 7h8"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-warning": {
    id: "message-square-warning",
    label: "Message Square Warning",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="M12 15h.01"/><path d="M12 7v4"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "message-square-x": {
    id: "message-square-x",
    label: "Message Square X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/><path d="m14.5 8.5-5 5"/><path d="m9.5 8.5 5 5"/></g>',
    viewBox: [0.938, 1.938, 22.125, 21.125],
  },
  "messages-square": {
    id: "messages-square",
    label: "Messages Square",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/><path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  metronome: {
    id: "metronome",
    label: "Metronome",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 11.4V9.1"/><path d="m12 17 6.59-6.59"/><path d="m15.05 5.7-.218-.691a3 3 0 0 0-5.663 0L4.418 19.695A1 1 0 0 0 5.37 21h13.253a1 1 0 0 0 .951-1.31L18.45 16.2"/><circle cx="20" cy="9" r="2"/></g>',
    viewBox: [3.313, 1.938, 19.75, 20.125],
  },
  mic: {
    id: "mic",
    label: "Mic",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 19v3"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><rect x="9" y="2" width="6" height="13" rx="3"/></g>',
    viewBox: [3.938, 0.938, 16.125, 22.125],
  },
  "mic-off": {
    id: "mic-off",
    label: "Mic Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 19v3"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M16.95 16.95A7 7 0 0 1 5 12v-2"/><path d="M18.89 13.23A7 7 0 0 0 19 12v-2"/><path d="m2 2 20 20"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "mic-vocal": {
    id: "mic-vocal",
    label: "Mic Vocal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12"/><path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5"/><circle cx="16" cy="7" r="5"/></g>',
    viewBox: [3.688, 0.938, 18.375, 22.25],
  },
  microchip: {
    id: "microchip",
    label: "Microchip",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 12h4"/><path d="M10 17h4"/><path d="M10 7h4"/><path d="M18 12h2"/><path d="M18 18h2"/><path d="M18 6h2"/><path d="M4 12h2"/><path d="M4 18h2"/><path d="M4 6h2"/><rect x="6" y="2" width="12" height="20" rx="2"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  microscope: {
    id: "microscope",
    label: "Microscope",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  microwave: {
    id: "microwave",
    label: "Microwave",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="20" height="15" x="2" y="4" rx="2"/><rect width="8" height="7" x="6" y="8" rx="1"/><path d="M18 8v7"/><path d="M6 19v2"/><path d="M18 19v2"/></g>',
    viewBox: [0.938, 2.938, 22.125, 19.125],
  },
  milestone: {
    id: "milestone",
    label: "Milestone",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 13v8"/><path d="M12 3v3"/><path d="M18.172 6a2 2 0 0 1 1.414.586l2.06 2.06a1.207 1.207 0 0 1 0 1.708l-2.06 2.06a2 2 0 0 1-1.414.586H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z"/></g>',
    viewBox: [1.938, 1.938, 21.125, 20.125],
  },
  milk: {
    id: "milk",
    label: "Milk",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 2h8"/><path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2"/><path d="M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0"/></g>',
    viewBox: [5.938, 0.938, 12.125, 22.125],
  },
  "milk-off": {
    id: "milk-off",
    label: "Milk Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 2h8"/><path d="M9 2v1.343M15 2v2.789a4 4 0 0 0 .672 2.219l.656.984a4 4 0 0 1 .672 2.22v1.131M7.8 7.8l-.128.192A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3"/><path d="M7 15a6.47 6.47 0 0 1 5 0 6.472 6.472 0 0 0 3.435.435"/><line x1="2" x2="22" y1="2" y2="22"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  minimize: {
    id: "minimize",
    label: "Minimize",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "minimize-2": {
    id: "minimize-2",
    label: "Minimize 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m14 10 7-7"/><path d="M20 10h-6V4"/><path d="m3 21 7-7"/><path d="M4 14h6v6"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  minus: {
    id: "minus",
    label: "Minus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5 12h14"/></g>',
    viewBox: [3.938, 10.938, 16.125, 2.125],
  },
  "mirror-rectangular": {
    id: "mirror-rectangular",
    label: "Mirror Rectangular",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 6 8 9"/><path d="m16 7-8 8"/><rect x="4" y="2" width="16" height="20" rx="2"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "mirror-round": {
    id: "mirror-round",
    label: "Mirror Round",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 6.6 8.6 8"/><path d="M12 18v4"/><path d="M15 7.5 9.5 13"/><path d="M7 22h10"/><circle cx="12" cy="10" r="8"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  monitor: {
    id: "monitor",
    label: "Monitor",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-check": {
    id: "monitor-check",
    label: "Monitor Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m9 10 2 2 4-4"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-cloud": {
    id: "monitor-cloud",
    label: "Monitor Cloud",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 13a3 3 0 1 1 2.83-4H14a2 2 0 0 1 0 4z"/><path d="M12 17v4"/><path d="M8 21h8"/><rect x="2" y="3" width="20" height="14" rx="2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-cog": {
    id: "monitor-cog",
    label: "Monitor Cog",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 17v4"/><path d="m14.305 7.53.923-.382"/><path d="m15.228 4.852-.923-.383"/><path d="m16.852 3.228-.383-.924"/><path d="m16.852 8.772-.383.923"/><path d="m19.148 3.228.383-.924"/><path d="m19.53 9.696-.382-.924"/><path d="m20.772 4.852.924-.383"/><path d="m20.772 7.148.924.383"/><path d="M22 13v2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="M8 21h8"/><circle cx="18" cy="6" r="3"/></g>',
    viewBox: [0.938, 1.188, 22.125, 20.875],
  },
  "monitor-dot": {
    id: "monitor-dot",
    label: "Monitor Dot",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 17v4"/><path d="M22 12.307V15a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8.693"/><path d="M8 21h8"/><circle cx="19" cy="6" r="3"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-down": {
    id: "monitor-down",
    label: "Monitor Down",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 13V7"/><path d="m15 10-3 3-3-3"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-off": {
    id: "monitor-off",
    label: "Monitor Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 17v4"/><path d="M17 17H4a2 2 0 0 1-2-2V5a2 2 0 0 1 1.184-1.826"/><path d="m2 2 20 20"/><path d="M8 21h8"/><path d="M8.656 3H20a2 2 0 0 1 2 2v10a2 2 0 0 1-.293 1.042"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "monitor-pause": {
    id: "monitor-pause",
    label: "Monitor Pause",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 13V7"/><path d="M14 13V7"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-play": {
    id: "monitor-play",
    label: "Monitor Play",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15.033 9.44a.647.647 0 0 1 0 1.12l-4.065 2.352a.645.645 0 0 1-.968-.56V7.648a.645.645 0 0 1 .967-.56z"/><path d="M12 17v4"/><path d="M8 21h8"/><rect x="2" y="3" width="20" height="14" rx="2"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-smartphone": {
    id: "monitor-smartphone",
    label: "Monitor Smartphone",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/><path d="M10 19v-3.96 3.15"/><path d="M7 19h5"/><rect width="6" height="10" x="16" y="12" rx="2"/></g>',
    viewBox: [0.938, 2.938, 22.125, 20.125],
  },
  "monitor-speaker": {
    id: "monitor-speaker",
    label: "Monitor Speaker",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5.5 20H8"/><path d="M17 9h.01"/><rect width="10" height="16" x="12" y="4" rx="2"/><path d="M8 6H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h4"/><circle cx="17" cy="15" r="1"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  "monitor-stop": {
    id: "monitor-stop",
    label: "Monitor Stop",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 17v4"/><path d="M8 21h8"/><rect x="2" y="3" width="20" height="14" rx="2"/><rect x="9" y="7" width="6" height="6" rx="1"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-up": {
    id: "monitor-up",
    label: "Monitor Up",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m9 10 3-3 3 3"/><path d="M12 13V7"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "monitor-x": {
    id: "monitor-x",
    label: "Monitor X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m14.5 12.5-5-5"/><path d="m9.5 12.5 5-5"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  moon: {
    id: "moon",
    label: "Moon",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "moon-star": {
    id: "moon-star",
    label: "Moon Star",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 5h4"/><path d="M20 3v4"/><path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></g>',
    viewBox: [1.938, 1.938, 21.125, 20.125],
  },
  motorbike: {
    id: "motorbike",
    label: "Motorbike",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m18 14-1-3"/><path d="m3 9 6 2a2 2 0 0 1 2-2h2a2 2 0 0 1 1.99 1.81"/><path d="M8 17h3a1 1 0 0 0 1-1 6 6 0 0 1 6-6 1 1 0 0 0 1-1v-.75A5 5 0 0 0 17 5"/><circle cx="19" cy="17" r="3"/><circle cx="5" cy="17" r="3"/></g>',
    viewBox: [0.938, 3.938, 22.125, 17.125],
  },
  mountain: {
    id: "mountain",
    label: "Mountain",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  "mountain-snow": {
    id: "mountain-snow",
    label: "Mountain Snow",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/></g>',
    viewBox: [0.938, 1.938, 22.125, 20.125],
  },
  mouse: {
    id: "mouse",
    label: "Mouse",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/></g>',
    viewBox: [3.938, 0.938, 16.125, 22.125],
  },
  "mouse-left": {
    id: "mouse-left",
    label: "Mouse Left",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 7.318V10"/><path d="M5 10v5a7 7 0 0 0 14 0V9c0-3.527-2.608-6.515-6-7"/><circle cx="7" cy="4" r="2"/></g>',
    viewBox: [3.938, 0.938, 16.125, 22.125],
  },
  "mouse-off": {
    id: "mouse-off",
    label: "Mouse Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 6v.343"/><path d="M18.218 18.218A7 7 0 0 1 5 15V9a7 7 0 0 1 .782-3.218"/><path d="M19 13.343V9A7 7 0 0 0 8.56 2.902"/><path d="M22 22 2 2"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "mouse-pointer": {
    id: "mouse-pointer",
    label: "Mouse Pointer",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12.586 12.586 19 19"/><path d="M3.688 3.037a.497.497 0 0 0-.651.651l6.5 15.999a.501.501 0 0 0 .947-.062l1.569-6.083a2 2 0 0 1 1.448-1.479l6.124-1.579a.5.5 0 0 0 .063-.947z"/></g>',
    viewBox: [1.938, 1.938, 19.125, 19.125],
  },
  "mouse-pointer-2": {
    id: "mouse-pointer-2",
    label: "Mouse Pointer 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/></g>',
    viewBox: [2.938, 2.938, 19.125, 19.125],
  },
  "mouse-pointer-2-off": {
    id: "mouse-pointer-2-off",
    label: "Mouse Pointer 2 Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m15.55 8.45 5.138 2.087a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063L8.45 15.551"/><path d="M22 2 2 22"/><path d="m6.816 11.528-2.779-6.84a.495.495 0 0 1 .651-.651l6.84 2.779"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "mouse-pointer-ban": {
    id: "mouse-pointer-ban",
    label: "Mouse Pointer Ban",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2.034 2.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.944L8.204 7.545a1 1 0 0 0-.66.66l-1.066 3.443a.5.5 0 0 1-.944.033z"/><circle cx="16" cy="16" r="6"/><path d="m11.8 11.8 8.4 8.4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "mouse-pointer-click": {
    id: "mouse-pointer-click",
    label: "Mouse Pointer Click",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 4.1 12 6"/><path d="m5.1 8-2.9-.8"/><path d="m6 12-1.9 2"/><path d="M7.2 2.2 8 5.1"/><path d="M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z"/></g>',
    viewBox: [1.063, 1.063, 21, 21],
  },
  "mouse-right": {
    id: "mouse-right",
    label: "Mouse Right",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 7.318V10"/><path d="M19 10v5a7 7 0 0 1-14 0V9c0-3.527 2.608-6.515 6-7"/><circle cx="17" cy="4" r="2"/></g>',
    viewBox: [3.938, 0.938, 16.125, 22.125],
  },
  move: {
    id: "move",
    label: "Move",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 2v20"/><path d="m15 19-3 3-3-3"/><path d="m19 9 3 3-3 3"/><path d="M2 12h20"/><path d="m5 9-3 3 3 3"/><path d="m9 5 3-3 3 3"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "move-3d": {
    id: "move-3d",
    label: "Move 3D",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5 3v16h16"/><path d="m5 19 6-6"/><path d="m2 6 3-3 3 3"/><path d="m18 16 3 3-3 3"/></g>',
    viewBox: [0.938, 1.938, 21.125, 21.125],
  },
  "move-diagonal": {
    id: "move-diagonal",
    label: "Move Diagonal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 19H5v-6"/><path d="M13 5h6v6"/><path d="M19 5 5 19"/></g>',
    viewBox: [3.938, 3.938, 16.125, 16.125],
  },
  "move-diagonal-2": {
    id: "move-diagonal-2",
    label: "Move Diagonal 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19 13v6h-6"/><path d="M5 11V5h6"/><path d="m5 5 14 14"/></g>',
    viewBox: [3.938, 3.938, 16.125, 16.125],
  },
  "move-down": {
    id: "move-down",
    label: "Move Down",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 18L12 22L16 18"/><path d="M12 2V22"/></g>',
    viewBox: [6.938, 0.938, 10.125, 22.125],
  },
  "move-down-left": {
    id: "move-down-left",
    label: "Move Down Left",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 19H5V13"/><path d="M19 5L5 19"/></g>',
    viewBox: [3.938, 3.938, 16.125, 16.125],
  },
  "move-down-right": {
    id: "move-down-right",
    label: "Move Down Right",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19 13V19H13"/><path d="M5 5L19 19"/></g>',
    viewBox: [3.938, 3.938, 16.125, 16.125],
  },
  "move-horizontal": {
    id: "move-horizontal",
    label: "Move Horizontal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/></g>',
    viewBox: [0.938, 6.938, 22.125, 10.125],
  },
  "move-left": {
    id: "move-left",
    label: "Move Left",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M6 8L2 12L6 16"/><path d="M2 12H22"/></g>',
    viewBox: [0.938, 6.938, 22.125, 10.125],
  },
  "move-right": {
    id: "move-right",
    label: "Move Right",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 8L22 12L18 16"/><path d="M2 12H22"/></g>',
    viewBox: [0.938, 6.938, 22.125, 10.125],
  },
  "move-up": {
    id: "move-up",
    label: "Move Up",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 6L12 2L16 6"/><path d="M12 2V22"/></g>',
    viewBox: [6.938, 0.938, 10.125, 22.125],
  },
  "move-up-left": {
    id: "move-up-left",
    label: "Move Up Left",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5 11V5H11"/><path d="M5 5L19 19"/></g>',
    viewBox: [3.938, 3.938, 16.125, 16.125],
  },
  "move-up-right": {
    id: "move-up-right",
    label: "Move Up Right",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13 5H19V11"/><path d="M19 5L5 19"/></g>',
    viewBox: [3.938, 3.938, 16.125, 16.125],
  },
  "move-vertical": {
    id: "move-vertical",
    label: "Move Vertical",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 2v20"/><path d="m8 18 4 4 4-4"/><path d="m8 6 4-4 4 4"/></g>',
    viewBox: [6.938, 0.938, 10.125, 22.125],
  },
  music: {
    id: "music",
    label: "Music",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "music-2": {
    id: "music-2",
    label: "Music 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="8" cy="18" r="4"/><path d="M12 18V2l7 4"/></g>',
    viewBox: [2.938, 0.938, 17.125, 22.125],
  },
  "music-3": {
    id: "music-3",
    label: "Music 3",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="18" r="4"/><path d="M16 18V2"/></g>',
    viewBox: [6.938, 0.938, 10.125, 22.125],
  },
  "music-4": {
    id: "music-4",
    label: "Music 4",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 18V5l12-2v13"/><path d="m9 9 12-2"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
} satisfies LucideIconAssetMap;

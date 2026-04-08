import type { LucideIconAssetMap } from "../../../icon-system-contract.js";

export const lucideIconChunk = {
  lamp: {
    id: "lamp",
    label: "Lamp",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 12v6"/><path d="M4.077 10.615A1 1 0 0 0 5 12h14a1 1 0 0 0 .923-1.385l-3.077-7.384A2 2 0 0 0 15 2H9a2 2 0 0 0-1.846 1.23Z"/><path d="M8 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1z"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
  "lamp-ceiling": {
    id: "lamp-ceiling",
    label: "Lamp Ceiling",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 2v5"/><path d="M14.829 15.998a3 3 0 1 1-5.658 0"/><path d="M20.92 14.606A1 1 0 0 1 20 16H4a1 1 0 0 1-.92-1.394l3-7A1 1 0 0 1 7 7h10a1 1 0 0 1 .92.606z"/></g>',
    viewBox: [1.938, 0.938, 20.125, 20.125],
  },
  "lamp-desk": {
    id: "lamp-desk",
    label: "Lamp Desk",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10.293 2.293a1 1 0 0 1 1.414 0l2.5 2.5 5.994 1.227a1 1 0 0 1 .506 1.687l-7 7a1 1 0 0 1-1.687-.506l-1.227-5.994-2.5-2.5a1 1 0 0 1 0-1.414z"/><path d="m14.207 4.793-3.414 3.414"/><path d="M3 20a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="m9.086 6.5-4.793 4.793a1 1 0 0 0-.18 1.17L7 18"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "lamp-floor": {
    id: "lamp-floor",
    label: "Lamp Floor",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 10v12"/><path d="M17.929 7.629A1 1 0 0 1 17 9H7a1 1 0 0 1-.928-1.371l2-5A1 1 0 0 1 9 2h6a1 1 0 0 1 .928.629z"/><path d="M9 22h6"/></g>',
    viewBox: [4.938, 0.938, 14.125, 22.125],
  },
  "lamp-wall-down": {
    id: "lamp-wall-down",
    label: "Lamp Wall Down",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19.929 18.629A1 1 0 0 1 19 20H9a1 1 0 0 1-.928-1.371l2-5A1 1 0 0 1 11 13h6a1 1 0 0 1 .928.629z"/><path d="M6 3a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 6h4a2 2 0 0 1 2 2v5"/></g>',
    viewBox: [2.938, 1.938, 18.125, 19.125],
  },
  "lamp-wall-up": {
    id: "lamp-wall-up",
    label: "Lamp Wall Up",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M19.929 9.629A1 1 0 0 1 19 11H9a1 1 0 0 1-.928-1.371l2-5A1 1 0 0 1 11 4h6a1 1 0 0 1 .928.629z"/><path d="M6 15a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1z"/><path d="M8 18h4a2 2 0 0 0 2-2v-5"/></g>',
    viewBox: [2.938, 2.938, 18.125, 19.125],
  },
  "land-plot": {
    id: "land-plot",
    label: "Land Plot",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m12 8 6-3-6-3v10"/><path d="m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12"/><path d="m6.49 12.85 11.02 6.3"/><path d="M17.51 12.85 6.5 19.15"/></g>',
    viewBox: [0.813, 0.938, 22.375, 22.125],
  },
  landmark: {
    id: "landmark",
    label: "Landmark",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 18v-7"/><path d="M11.12 2.198a2 2 0 0 1 1.76.006l7.866 3.847c.476.233.31.949-.22.949H3.474c-.53 0-.695-.716-.22-.949z"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="M3 22h18"/><path d="M6 18v-7"/></g>',
    viewBox: [1.813, 0.938, 20.375, 22.125],
  },
  languages: {
    id: "languages",
    label: "Languages",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  laptop: {
    id: "laptop",
    label: "Laptop",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z"/><path d="M20.054 15.987H3.946"/></g>',
    viewBox: [1.438, 3.938, 21.125, 17.125],
  },
  "laptop-minimal": {
    id: "laptop-minimal",
    label: "Laptop Minimal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="12" x="3" y="4" rx="2" ry="2"/><line x1="2" x2="22" y1="20" y2="20"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  "laptop-minimal-check": {
    id: "laptop-minimal-check",
    label: "Laptop Minimal Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 20h20"/><path d="m9 10 2 2 4-4"/><rect x="3" y="4" width="18" height="12" rx="2"/></g>',
    viewBox: [0.938, 2.938, 22.125, 18.125],
  },
  lasso: {
    id: "lasso",
    label: "Lasso",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3.704 14.467a10 8 0 1 1 3.115 2.375"/><path d="M7 22a5 5 0 0 1-2-3.994"/><circle cx="5" cy="16" r="2"/></g>',
    viewBox: [0.813, 0.938, 22.25, 22.125],
  },
  "lasso-select": {
    id: "lasso-select",
    label: "Lasso Select",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 22a5 5 0 0 1-2-4"/><path d="M7 16.93c.96.43 1.96.74 2.99.91"/><path d="M3.34 14A6.8 6.8 0 0 1 2 10c0-4.42 4.48-8 10-8s10 3.58 10 8a7.19 7.19 0 0 1-.33 2"/><path d="M5 18a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"/><path d="M14.33 22h-.09a.35.35 0 0 1-.24-.32v-10a.34.34 0 0 1 .33-.34c.08 0 .15.03.21.08l7.34 6a.33.33 0 0 1-.21.59h-4.49l-2.57 3.85a.35.35 0 0 1-.28.14z"/></g>',
    viewBox: [0.938, 0.938, 22.25, 22.125],
  },
  laugh: {
    id: "laugh",
    label: "Laugh",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  layers: {
    id: "layers",
    label: "Layers",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/></g>',
    viewBox: [0.938, 0.938, 22.25, 22.125],
  },
  "layers-2": {
    id: "layers-2",
    label: "Layers 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13 13.74a2 2 0 0 1-2 0L2.5 8.87a1 1 0 0 1 0-1.74L11 2.26a2 2 0 0 1 2 0l8.5 4.87a1 1 0 0 1 0 1.74z"/><path d="m20 14.285 1.5.845a1 1 0 0 1 0 1.74L13 21.74a2 2 0 0 1-2 0l-8.5-4.87a1 1 0 0 1 0-1.74l1.5-.845"/></g>',
    viewBox: [0.813, 0.813, 22.375, 22.375],
  },
  "layers-plus": {
    id: "layers-plus",
    label: "Layers Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 .83.18 2 2 0 0 0 .83-.18l8.58-3.9a1 1 0 0 0 0-1.831z"/><path d="M16 17h6"/><path d="M19 14v6"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 .825.178"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l2.116-.962"/></g>',
    viewBox: [0.938, 0.938, 22.25, 22.125],
  },
  "layout-dashboard": {
    id: "layout-dashboard",
    label: "Layout Dashboard",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "layout-grid": {
    id: "layout-grid",
    label: "Layout Grid",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "layout-list": {
    id: "layout-list",
    label: "Layout List",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><path d="M14 4h7"/><path d="M14 9h7"/><path d="M14 15h7"/><path d="M14 20h7"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "layout-panel-left": {
    id: "layout-panel-left",
    label: "Layout Panel Left",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="7" height="18" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "layout-panel-top": {
    id: "layout-panel-top",
    label: "Layout Panel Top",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "layout-template": {
    id: "layout-template",
    label: "Layout Template",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="7" x="3" y="3" rx="1"/><rect width="9" height="7" x="3" y="14" rx="1"/><rect width="5" height="7" x="16" y="14" rx="1"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  leaf: {
    id: "leaf",
    label: "Leaf",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></g>',
    viewBox: [0.938, 0.938, 21.125, 21.125],
  },
  "leafy-green": {
    id: "leafy-green",
    label: "Leafy Green",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22"/><path d="M2 22 17 7"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.25],
  },
  lectern: {
    id: "lectern",
    label: "Lectern",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 12h3a2 2 0 0 0 1.902-1.38l1.056-3.333A1 1 0 0 0 21 6H3a1 1 0 0 0-.958 1.287l1.056 3.334A2 2 0 0 0 5 12h3"/><path d="M18 6V3a1 1 0 0 0-1-1h-3"/><rect width="8" height="12" x="8" y="10" rx="1"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "lens-concave": {
    id: "lens-concave",
    label: "Lens Concave",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 2a1 1 0 0 0-.8 1.6 14 14 0 0 1 0 16.8A1 1 0 0 0 7 22h10a1 1 0 0 0 .8-1.6 14 14 0 0 1 0-16.8A1 1 0 0 0 17 2z"/></g>',
    viewBox: [4.938, 0.938, 14.125, 22.125],
  },
  "lens-convex": {
    id: "lens-convex",
    label: "Lens Convex",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13.433 2a1 1 0 0 1 .824.448 18 18 0 0 1 0 19.104 1 1 0 0 1-.824.448h-2.866a1 1 0 0 1-.824-.448 18 18 0 0 1 0-19.104A1 1 0 0 1 10.567 2z"/></g>',
    viewBox: [5.938, 0.938, 12.125, 22.125],
  },
  library: {
    id: "library",
    label: "Library",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></g>',
    viewBox: [2.938, 2.938, 18.125, 18.125],
  },
  "library-big": {
    id: "library-big",
    label: "Library Big",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="8" height="18" x="3" y="3" rx="1"/><path d="M7 3v18"/><path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z"/></g>',
    viewBox: [1.938, 1.938, 19.625, 20.125],
  },
  "life-buoy": {
    id: "life-buoy",
    label: "Life Buoy",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/><circle cx="12" cy="12" r="4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  ligature: {
    id: "ligature",
    label: "Ligature",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M14 12h2v8"/><path d="M14 20h4"/><path d="M6 12h4"/><path d="M6 20h4"/><path d="M8 20V8a4 4 0 0 1 7.464-2"/></g>',
    viewBox: [4.938, 2.938, 14.125, 18.125],
  },
  lightbulb: {
    id: "lightbulb",
    label: "Lightbulb",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></g>',
    viewBox: [4.938, 0.938, 14.125, 22.125],
  },
  "lightbulb-off": {
    id: "lightbulb-off",
    label: "Lightbulb Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16.8 11.2c.8-.9 1.2-2 1.2-3.2a6 6 0 0 0-9.3-5"/><path d="m2 2 20 20"/><path d="M6.3 6.3a4.67 4.67 0 0 0 1.2 5.2c.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "line-dot-right-horizontal": {
    id: "line-dot-right-horizontal",
    label: "Line Dot Right Horizontal",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M 3 12 L 15 12"/><circle cx="18" cy="12" r="3"/></g>',
    viewBox: [1.938, 7.938, 20.125, 8.125],
  },
  "line-squiggle": {
    id: "line-squiggle",
    label: "Line Squiggle",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M7 3.5c5-2 7 2.5 3 4C1.5 10 2 15 5 16c5 2 9-10 14-7s.5 13.5-4 12c-5-2.5.5-11 6-2"/></g>',
    viewBox: [1.938, 1.938, 20.375, 20.375],
  },
  "line-style": {
    id: "line-style",
    label: "Line Style",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 5h2"/><path d="M15 12h6"/><path d="M19 5h2"/><path d="M3 12h6"/><path d="M3 19h18"/><path d="M3 5h2"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  link: {
    id: "link",
    label: "Link",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "link-2": {
    id: "link-2",
    label: "Link 2",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 17H7A5 5 0 0 1 7 7h2"/><path d="M15 7h2a5 5 0 1 1 0 10h-2"/><line x1="8" x2="16" y1="12" y2="12"/></g>',
    viewBox: [0.938, 5.938, 22.125, 12.125],
  },
  "link-2-off": {
    id: "link-2-off",
    label: "Link 2 Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M9 17H7A5 5 0 0 1 7 7"/><path d="M15 7h2a5 5 0 0 1 4 8"/><line x1="8" x2="12" y1="12" y2="12"/><line x1="2" x2="22" y1="2" y2="22"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  list: {
    id: "list",
    label: "List",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-check": {
    id: "list-check",
    label: "List Check",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 5H3"/><path d="M16 12H3"/><path d="M11 19H3"/><path d="m15 18 2 2 4-4"/></g>',
    viewBox: [1.938, 3.938, 20.125, 17.125],
  },
  "list-checks": {
    id: "list-checks",
    label: "List Checks",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-chevrons-down-up": {
    id: "list-chevrons-down-up",
    label: "List Chevrons Down Up",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 5h8"/><path d="M3 12h8"/><path d="M3 19h8"/><path d="m15 5 3 3 3-3"/><path d="m15 19 3-3 3 3"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-chevrons-up-down": {
    id: "list-chevrons-up-down",
    label: "List Chevrons Up Down",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 5h8"/><path d="M3 12h8"/><path d="M3 19h8"/><path d="m15 8 3-3 3 3"/><path d="m15 16 3 3 3-3"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-collapse": {
    id: "list-collapse",
    label: "List Collapse",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M10 5h11"/><path d="M10 12h11"/><path d="M10 19h11"/><path d="m3 10 3-3-3-3"/><path d="m3 20 3-3-3-3"/></g>',
    viewBox: [1.938, 2.938, 20.125, 18.125],
  },
  "list-end": {
    id: "list-end",
    label: "List End",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 5H3"/><path d="M16 12H3"/><path d="M9 19H3"/><path d="m16 16-3 3 3 3"/><path d="M21 5v12a2 2 0 0 1-2 2h-6"/></g>',
    viewBox: [1.938, 3.938, 20.125, 19.125],
  },
  "list-filter": {
    id: "list-filter",
    label: "List Filter",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M2 5h20"/><path d="M6 12h12"/><path d="M9 19h6"/></g>',
    viewBox: [0.938, 3.938, 22.125, 16.125],
  },
  "list-filter-plus": {
    id: "list-filter-plus",
    label: "List Filter Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 5H2"/><path d="M6 12h12"/><path d="M9 19h6"/><path d="M16 5h6"/><path d="M19 8V2"/></g>',
    viewBox: [0.938, 0.938, 22.125, 19.125],
  },
  "list-indent-decrease": {
    id: "list-indent-decrease",
    label: "List Indent Decrease",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H11"/><path d="M21 12H11"/><path d="M21 19H11"/><path d="m7 8-4 4 4 4"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-indent-increase": {
    id: "list-indent-increase",
    label: "List Indent Increase",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H11"/><path d="M21 12H11"/><path d="M21 19H11"/><path d="m3 8 4 4-4 4"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-minus": {
    id: "list-minus",
    label: "List Minus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 5H3"/><path d="M11 12H3"/><path d="M16 19H3"/><path d="M21 12h-6"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-music": {
    id: "list-music",
    label: "List Music",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 5H3"/><path d="M11 12H3"/><path d="M11 19H3"/><path d="M21 16V5"/><circle cx="18" cy="16" r="3"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-ordered": {
    id: "list-ordered",
    label: "List Ordered",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></g>',
    viewBox: [2.313, 2.938, 19.75, 18.125],
  },
  "list-plus": {
    id: "list-plus",
    label: "List Plus",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 5H3"/><path d="M11 12H3"/><path d="M16 19H3"/><path d="M18 9v6"/><path d="M21 12h-6"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-restart": {
    id: "list-restart",
    label: "List Restart",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H3"/><path d="M7 12H3"/><path d="M7 19H3"/><path d="M12 18a5 5 0 0 0 9-3 4.5 4.5 0 0 0-4.5-4.5c-1.33 0-2.54.54-3.41 1.41L11 14"/><path d="M11 10v4h4"/></g>',
    viewBox: [1.938, 3.938, 20.125, 17.125],
  },
  "list-start": {
    id: "list-start",
    label: "List Start",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 5h6"/><path d="M3 12h13"/><path d="M3 19h13"/><path d="m16 8-3-3 3-3"/><path d="M21 19V7a2 2 0 0 0-2-2h-6"/></g>',
    viewBox: [1.938, 0.938, 20.125, 19.125],
  },
  "list-todo": {
    id: "list-todo",
    label: "List Todo",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><rect x="3" y="4" width="6" height="6" rx="1"/></g>',
    viewBox: [1.938, 2.938, 20.125, 17.125],
  },
  "list-tree": {
    id: "list-tree",
    label: "List Tree",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 5h13"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="M3 10a2 2 0 0 0 2 2h3"/><path d="M3 5v12a2 2 0 0 0 2 2h3"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  "list-video": {
    id: "list-video",
    label: "List Video",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 5H3"/><path d="M10 12H3"/><path d="M10 19H3"/><path d="M15 12.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997a1 1 0 0 1-1.517-.86z"/></g>',
    viewBox: [1.938, 3.938, 21.125, 16.125],
  },
  "list-x": {
    id: "list-x",
    label: "List X",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M16 5H3"/><path d="M11 12H3"/><path d="M16 19H3"/><path d="m15.5 9.5 5 5"/><path d="m20.5 9.5-5 5"/></g>',
    viewBox: [1.938, 3.938, 19.625, 16.125],
  },
  loader: {
    id: "loader",
    label: "Loader",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "loader-circle": {
    id: "loader-circle",
    label: "Loader Circle",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "loader-pinwheel": {
    id: "loader-pinwheel",
    label: "Loader Pinwheel",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M22 12a1 1 0 0 1-10 0 1 1 0 0 0-10 0"/><path d="M7 20.7a1 1 0 1 1 5-8.7 1 1 0 1 0 5-8.6"/><path d="M7 3.3a1 1 0 1 1 5 8.6 1 1 0 1 0 5 8.6"/><circle cx="12" cy="12" r="10"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  locate: {
    id: "locate",
    label: "Locate",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "locate-fixed": {
    id: "locate-fixed",
    label: "Locate Fixed",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><line x1="2" x2="5" y1="12" y2="12"/><line x1="19" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="5"/><line x1="12" x2="12" y1="19" y2="22"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  "locate-off": {
    id: "locate-off",
    label: "Locate Off",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 19v3"/><path d="M12 2v3"/><path d="M18.89 13.24a7 7 0 0 0-8.13-8.13"/><path d="M19 12h3"/><path d="M2 12h3"/><path d="m2 2 20 20"/><path d="M7.05 7.05a7 7 0 0 0 9.9 9.9"/></g>',
    viewBox: [0.938, 0.938, 22.125, 22.125],
  },
  lock: {
    id: "lock",
    label: "Lock",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "lock-keyhole": {
    id: "lock-keyhole",
    label: "Lock Keyhole",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="16" r="1"/><rect x="3" y="10" width="18" height="12" rx="2"/><path d="M7 10V7a5 5 0 0 1 10 0v3"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "lock-keyhole-open": {
    id: "lock-keyhole-open",
    label: "Lock Keyhole Open",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="16" r="1"/><rect width="18" height="12" x="3" y="10" rx="2"/><path d="M7 10V7a5 5 0 0 1 9.33-2.5"/></g>',
    viewBox: [1.938, 0.938, 20.125, 22.125],
  },
  "lock-open": {
    id: "lock-open",
    label: "Lock Open",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></g>',
    viewBox: [1.938, 0.813, 20.125, 22.25],
  },
  "log-in": {
    id: "log-in",
    label: "Log In",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  "log-out": {
    id: "log-out",
    label: "Log Out",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  logs: {
    id: "logs",
    label: "Logs",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M3 5h1"/><path d="M3 12h1"/><path d="M3 19h1"/><path d="M8 5h1"/><path d="M8 12h1"/><path d="M8 19h1"/><path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/></g>',
    viewBox: [1.938, 3.938, 20.125, 16.125],
  },
  lollipop: {
    id: "lollipop",
    label: "Lollipop",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/><path d="M11 11a2 2 0 0 0 4 0 4 4 0 0 0-8 0 6 6 0 0 0 12 0"/></g>',
    viewBox: [1.938, 1.938, 20.125, 20.125],
  },
  luggage: {
    id: "luggage",
    label: "Luggage",
    markup:
      '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M6 20a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2"/><path d="M8 18V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v14"/><path d="M10 20h4"/><circle cx="16" cy="20" r="2"/><circle cx="8" cy="20" r="2"/></g>',
    viewBox: [2.938, 0.938, 18.125, 22.125],
  },
} satisfies LucideIconAssetMap;

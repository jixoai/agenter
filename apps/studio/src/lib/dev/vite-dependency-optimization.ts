export const TERMINAL_VIEW_WORKSPACE_PACKAGE = "@agenter/terminal-view";
export const JIXO_CODEMIRROR_WORKSPACE_PACKAGE = "@jixo/codemirror";

export const codemirrorDedupe = [
  "@codemirror/autocomplete",
  "@codemirror/lang-json",
  "@codemirror/lang-markdown",
  "@codemirror/lang-sql",
  "@codemirror/lang-yaml",
  "@codemirror/language",
  "@codemirror/language-data",
  "@codemirror/state",
  "@codemirror/view",
];

// Workspace source packages whose Svelte/components exports can change while
// the Studio dev server stays alive must not be snapshotted into `.vite/deps`.
export const workspaceSourceDependencyExcludes = [TERMINAL_VIEW_WORKSPACE_PACKAGE, JIXO_CODEMIRROR_WORKSPACE_PACKAGE];

export const appOptimizeDepsInclude = [
  ...codemirrorDedupe,
  "@lezer/highlight",
  "@tanstack/svelte-virtual",
  "clsx",
  "highlight.js",
  "idb-keyval",
  "lit",
  "lit/decorators.js",
  "lit/directives/style-map.js",
  "lit/directives/unsafe-html.js",
  "lit/static-html.js",
  "tailwind-merge",
  "tailwind-variants",
  "yaml",
];

// Browser-based Vitest runs start from a fresh Vite server, so prebundling the
// terminal-view workspace package there avoids mid-run optimize reloads without
// reintroducing stale long-lived dev-host snapshots.
export const appVitestOptimizeDepsInclude = [...appOptimizeDepsInclude, TERMINAL_VIEW_WORKSPACE_PACKAGE];

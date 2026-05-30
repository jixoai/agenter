import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import type { GlobalTerminalEntry } from "@agenter/client-sdk";
import type { CliShellBootstrapResult, CliShellProductHostStore } from "../bootstrap";
import { resolveCliShellTuiKeybindings } from "../tui/keybindings";
import {
  startCliShellWebProductHost,
  type CliShellWebProductHost,
  type CliShellWebProductHostAction,
} from "./web-app-host";

const CLI_SHELL_WEB_HOST_TITLE = "agenter shell";
const CLI_SHELL_WEB_HOST_DESCRIPTION =
  "cli-shell --web hosts the existing backend terminal truth in a browser projection. Bun.Terminal-style PTY helpers are optional harness infrastructure only, not app truth.";
const CLI_SHELL_WEB_GEOMETRY_AUTHORITY_CLAIM_PATH = "/geometry-authority/claim";
const CLI_SHELL_WEB_GEOMETRY_AUTHORITY_RELEASE_PATH = "/geometry-authority/release";
const CLI_SHELL_WEB_APP_STATE_PATH = "/app-state.json";
const CLI_SHELL_WEB_APP_EVENT_PATH = "/app-event";
const CLI_SHELL_WEB_PERMISSION_REQUESTS_PATH = "/permission-requests.json";
const CLI_SHELL_WEB_APPROVAL_ACTION_PATH = "/approval-action";
const TERMINAL_VIEW_SOURCE_PATH = resolve(import.meta.dir, "../../../terminal-view/src/index.ts");
const TERMINAL_TRANSPORT_PROTOCOL_SOURCE_PATH = resolve(
  import.meta.dir,
  "../../../terminal-transport-protocol/src/index.ts",
);

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

interface CliShellBrowserHostConfig {
  terminalId: string;
  transportUrl: string;
  snapshotUrl: string;
  productStateUrl: string;
  productEventUrl: string;
  permissionRequestsUrl: string;
  approvalActionUrl: string;
  requestedGeometryRole: "projection-only" | "authority";
  geometryAuthority: {
    enabled: boolean;
    claimUrl: string;
    releaseUrl: string;
    geometryOrder?: number;
  };
  rendererPreference: "auto" | "ghostty-web" | "wterm" | "xterm";
}

interface CliShellWebGeometryAuthorityAdapterState {
  enabled: boolean;
  geometryOrder?: number;
}

interface CliShellWebGeometryParticipationPayload {
  requestedGeometryRole: "projection-only" | "authority";
  geometryOrder?: number;
}

type CliShellWebApprovalActionPayload =
  | { action: "approve"; terminalId: string; requestId: string; durationMs?: number }
  | { action: "deny"; terminalId: string; requestId: string };

const createCliShellWebGeometryAuthorityAdapterState = (
  enabled: boolean,
  geometryOrder?: number,
): CliShellWebGeometryAuthorityAdapterState => ({
  enabled,
  geometryOrder,
});

const normalizeGeometryAuthorityPageId = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const claimCliShellWebGeometryAuthority = (
  state: CliShellWebGeometryAuthorityAdapterState,
  pageId: string,
): CliShellWebGeometryParticipationPayload => {
  if (pageId.length === 0) {
    return {
      requestedGeometryRole: "projection-only",
    };
  }
  if (!state.enabled) {
    return {
      requestedGeometryRole: "projection-only",
    };
  }
  return {
    requestedGeometryRole: "authority",
    geometryOrder: state.geometryOrder,
  };
};

const releaseCliShellWebGeometryAuthority = (): CliShellWebGeometryParticipationPayload => ({
  requestedGeometryRole: "projection-only",
});

const readJsonBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Uint8Array[] = [];
  for await (const chunk of request) {
    if (chunk instanceof Uint8Array) {
      chunks.push(chunk);
      continue;
    }
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return null;
  }
  const payload = Buffer.concat(chunks).toString("utf8").trim();
  if (payload.length === 0) {
    return null;
  }
  return JSON.parse(payload) as unknown;
};

const writeJsonResponse = (response: ServerResponse, statusCode: number, payload: unknown): void => {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
};

const toTerminalSnapshotPayload = (entry: GlobalTerminalEntry): NonNullable<GlobalTerminalEntry["snapshot"]> => {
  if (!entry.snapshot) {
    return {
      seq: 0,
      timestamp: Date.now(),
      cols: 80,
      rows: 24,
      lines: Array.from({ length: 24 }, () => ""),
      richLines: Array.from({ length: 24 }, () => ({ spans: [] })),
      cursor: { x: 0, y: 0, visible: false },
      scrollback: {
        viewportOffset: 0,
        totalLines: 24,
        screenLines: 24,
      },
    };
  }
  return entry.snapshot;
};

const toSnapshotPayloadFromProductHost = (
  productHost: CliShellWebProductHost,
  fallbackEntry: GlobalTerminalEntry,
): NonNullable<GlobalTerminalEntry["snapshot"]> => {
  const surface = productHost.getSnapshot().surface;
  if (!surface) {
    return toTerminalSnapshotPayload(fallbackEntry);
  }
  return {
    seq: fallbackEntry.snapshot?.seq ?? surface.shellSnapshotSeq,
    timestamp: Date.now(),
    cols: surface.cols,
    rows: surface.rows,
    lines: [...surface.terminalLines],
    richLines: surface.terminalRichLines?.map((line) => ({
      spans: line.spans.map((span) => ({ ...span })),
    })),
    cursor: { ...surface.cursor },
    scrollback: { ...surface.scrollback },
  };
};

const isCliShellWebProductHostAction = (value: unknown): value is CliShellWebProductHostAction => {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const action = value as { type?: unknown };
  return (
    action.type === "open-dialogue" ||
    action.type === "close-dialogue" ||
    action.type === "focus-terminal" ||
    action.type === "focus-dialogue" ||
    action.type === "set-dialogue-draft" ||
    action.type === "append-dialogue-draft" ||
    action.type === "submit-dialogue" ||
    action.type === "paste" ||
    action.type === "shell-scroll-delta" ||
    action.type === "shell-scroll-target" ||
    action.type === "shell-scrollbar-target" ||
    action.type === "dialogue-scroll-delta" ||
    action.type === "resize"
  );
};

const isCliShellWebApprovalActionPayload = (value: unknown): value is CliShellWebApprovalActionPayload => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const payload = value as {
    action?: unknown;
    terminalId?: unknown;
    requestId?: unknown;
    durationMs?: unknown;
  };
  if (typeof payload.terminalId !== "string" || payload.terminalId.trim().length === 0) {
    return false;
  }
  if (typeof payload.requestId !== "string" || payload.requestId.trim().length === 0) {
    return false;
  }
  if (payload.action === "deny") {
    return true;
  }
  if (payload.action !== "approve") {
    return false;
  }
  return (
    payload.durationMs === undefined ||
    (typeof payload.durationMs === "number" && Number.isFinite(payload.durationMs) && payload.durationMs > 0)
  );
};

const buildHostHtml = (input: { config: CliShellBrowserHostConfig }): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${escapeHtml(CLI_SHELL_WEB_HOST_TITLE)}</title>
    <meta name="description" content="${escapeHtml(CLI_SHELL_WEB_HOST_DESCRIPTION)}" />
    <style>
      :root {
        color-scheme: dark;
      }
      html,
      body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #0b0f13;
      }
      body {
        overflow: hidden;
      }
      #app {
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.__CLI_SHELL_WEB_HOST__ = ${JSON.stringify(input.config)};
    </script>
    <script type="module" src="/browser-entry.ts"></script>
  </body>
</html>`;

const requireTerminalEntry = async (
  store: CliShellProductHostStore,
  terminalId: string,
): Promise<GlobalTerminalEntry> => {
  const terminals = await store.hydrateGlobalTerminals({ force: true });
  const entry = terminals.find((candidate: GlobalTerminalEntry) => candidate.terminalId === terminalId);
  if (!entry) {
    throw new Error(`attached terminal missing from global terminal catalog: ${terminalId}`);
  }
  return entry;
};

const requireTerminalTransportUrl = (entry: GlobalTerminalEntry): string => {
  const transportUrl = entry.transportUrl?.trim();
  if (!transportUrl) {
    throw new Error(`attached terminal missing transportUrl: ${entry.terminalId}`);
  }
  return transportUrl;
};

const writeBrowserHostFiles = async (tempDir: string): Promise<void> => {
  await writeFile(
    join(tempDir, "browser-entry.ts"),
    `import { TERMINAL_VIEW_TAG, defineTerminalView } from "@agenter/terminal-view";

declare global {
  interface Window {
    __CLI_SHELL_WEB_HOST__?: CliShellBrowserHostConfig;
  }
}

interface CliShellBrowserHostConfig {
  terminalId: string;
  transportUrl: string;
  snapshotUrl: string;
  productStateUrl: string;
  productEventUrl: string;
  permissionRequestsUrl: string;
  approvalActionUrl: string;
  requestedGeometryRole: "projection-only" | "authority";
  geometryAuthority: {
    enabled: boolean;
    claimUrl: string;
    releaseUrl: string;
    geometryOrder?: number;
  };
  rendererPreference: "auto" | "ghostty-web" | "wterm" | "xterm";
}

const config = window.__CLI_SHELL_WEB_HOST__;
if (!config) {
  throw new Error("missing cli-shell web host config");
}

defineTerminalView();

const root = document.getElementById("app");
if (!(root instanceof HTMLElement)) {
  throw new Error("missing cli-shell web host root");
}

const view = document.createElement(TERMINAL_VIEW_TAG);
view.setAttribute("data-cli-shell-web-host", "terminal");
view.setAttribute("data-cli-shell-terminal-2-host", "true");
view.style.display = "block";
view.style.width = "100%";
view.style.height = "100%";
view.style.outline = "none";
view.terminalId = config.terminalId;
view.transportUrl = config.transportUrl;
view.liveTransportEnabled = true;
view.rendererPreference = config.rendererPreference;
view.geometryRole = config.requestedGeometryRole;
root.replaceChildren(view);

const refreshPermissionRequests = async (): Promise<void> => {
  const response = await fetch(config.permissionRequestsUrl);
  if (!response.ok) {
    return;
  }
  const payload = await response.json() as { items?: unknown[] };
  view.permissionRequests = Array.isArray(payload.items) ? payload.items : [];
};

view.addEventListener("terminal-view-approval-action", (event) => {
  const detail = (event as CustomEvent<{ terminalId: string; requestId: string; action: "approve" | "deny"; durationMs?: number }>).detail;
  void fetch(config.approvalActionUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(detail),
  }).then(() => refreshPermissionRequests());
});

const facts = document.createElement("pre");
facts.setAttribute("data-cli-shell-app-facts", "true");
facts.setAttribute("aria-hidden", "true");
facts.style.position = "fixed";
facts.style.left = "-10000px";
facts.style.top = "0";
facts.style.width = "1px";
facts.style.height = "1px";
facts.style.overflow = "hidden";
document.body.appendChild(facts);

const postProductEvent = async (action: unknown): Promise<void> => {
  const response = await fetch(config.productEventUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(action),
  });
  if (!response.ok) {
    throw new Error(\`cli-shell app event failed: \${response.status}\`);
  }
};

const refreshProductFacts = async (): Promise<void> => {
  const response = await fetch(config.productStateUrl);
  if (!response.ok) {
    return;
  }
  const state = await response.json() as {
    textEvidence?: string;
    surface?: {
      dialogueOpen?: boolean;
      dialoguePlacement?: string | null;
      bottomLine?: string;
      terminalLines?: string[];
      cursor?: { x?: number; y?: number; visible?: boolean };
      scrollback?: { viewportOffset?: number; totalLines?: number; screenLines?: number };
    } | null;
  };
  facts.textContent = state.textEvidence ?? "";
  view.setAttribute("data-cli-shell-dialogue-open", state.surface?.dialogueOpen === true ? "true" : "false");
  view.setAttribute("data-cli-shell-dialogue-placement", state.surface?.dialoguePlacement ?? "");
  view.setAttribute("data-cli-shell-bottom-line", state.surface?.bottomLine ?? "");
  if (state.surface?.cursor) {
    view.setAttribute("data-cli-shell-cursor-x", String(state.surface.cursor.x ?? 0));
    view.setAttribute("data-cli-shell-cursor-y", String(state.surface.cursor.y ?? 0));
    view.setAttribute("data-cli-shell-cursor-visible", state.surface.cursor.visible === false ? "false" : "true");
  }
  if (state.surface?.scrollback) {
    view.setAttribute("data-cli-shell-viewport-start", String(state.surface.scrollback.viewportOffset ?? 0));
    view.setAttribute("data-cli-shell-total-lines", String(state.surface.scrollback.totalLines ?? 0));
    view.setAttribute("data-cli-shell-screen-lines", String(state.surface.scrollback.screenLines ?? 0));
  }
};

let productFactsTimer: number | null = null;
const scheduleProductFactsRefresh = (): void => {
  if (productFactsTimer !== null) {
    window.clearTimeout(productFactsTimer);
  }
  productFactsTimer = window.setTimeout(() => {
      productFactsTimer = null;
      void refreshProductFacts();
      void refreshPermissionRequests();
    }, 40);
};

Object.assign(window, {
  __cliShellProductEvent: postProductEvent,
  __cliShellRefreshProductFacts: refreshProductFacts,
});

const pageId =
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : \`cli-shell-web-page-\${Date.now()}-\${Math.random().toString(16).slice(2)}\`;
let geometryAuthoritySync: Promise<"projection-only" | "authority"> | null = null;

const resolveViewportSize = (): { width: number; height: number } => {
  const rect = root.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || window.innerWidth || 1));
  const height = Math.max(1, Math.round(rect.height || window.innerHeight || 1));
  return { width, height };
};

const resolveViewportGrid = (): { cols: number; rows: number } | null => {
  const snapshot = view.snapshot;
  const screenMetrics = view.screenMetrics;
  if (!screenMetrics || !snapshot || snapshot.cols <= 0 || snapshot.rows <= 0) {
    return null;
  }
  const cellWidth = screenMetrics.width / snapshot.cols;
  const cellHeight = screenMetrics.height / snapshot.rows;
  if (!Number.isFinite(cellWidth) || cellWidth <= 0 || !Number.isFinite(cellHeight) || cellHeight <= 0) {
    return null;
  }
  const { width, height } = resolveViewportSize();
  const framePaddingX = Math.max(1, Math.ceil(cellWidth * 0.5));
  const framePaddingY = Math.max(1, Math.ceil(cellHeight * 0.5));
  return {
    cols: Math.max(1, Math.floor((width - framePaddingX * 2) / cellWidth)),
    rows: Math.max(1, Math.floor((height - framePaddingY * 2) / cellHeight)),
  };
};

let lastCommittedGrid: { cols: number; rows: number } | null = null;
let resizeFrame = 0;

const setGeometryParticipation = (input: {
  requestedGeometryRole: "projection-only" | "authority";
  geometryOrder?: number;
}): void => {
  if (view.geometryRole === input.requestedGeometryRole && view.geometryOrder === input.geometryOrder) {
    return;
  }
  view.geometryRole = input.requestedGeometryRole;
  view.geometryOrder = input.geometryOrder;
  lastCommittedGrid = null;
};

const syncGeometryAuthority = async (): Promise<"projection-only" | "authority"> => {
  if (!config.geometryAuthority.enabled) {
    setGeometryParticipation({ requestedGeometryRole: "projection-only" });
    return "projection-only";
  }
  if (geometryAuthoritySync) {
    return await geometryAuthoritySync;
  }
  geometryAuthoritySync = fetch(config.geometryAuthority.claimUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ pageId }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(\`geometry authority claim failed: \${response.status}\`);
      }
      return await response.json() as {
        requestedGeometryRole?: "projection-only" | "authority";
        geometryOrder?: number;
      };
    })
    .then((payload) => ({
      requestedGeometryRole: payload.requestedGeometryRole === "authority" ? "authority" : "projection-only",
      geometryOrder: payload.geometryOrder,
    }))
    .catch(() => ({ requestedGeometryRole: "projection-only" as const }))
    .then((participation) => {
      setGeometryParticipation(participation);
      return participation.requestedGeometryRole;
    })
    .finally(() => {
      geometryAuthoritySync = null;
    });
  return await geometryAuthoritySync;
};

const releaseGeometryAuthority = (): void => {
  setGeometryParticipation({ requestedGeometryRole: "projection-only" });
  const payload = JSON.stringify({ pageId });
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([payload], { type: "application/json" });
    navigator.sendBeacon(config.geometryAuthority.releaseUrl, blob);
    return;
  }
  void fetch(config.geometryAuthority.releaseUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
};

const syncViewportProjection = async (): Promise<void> => {
  const { width, height } = resolveViewportSize();
  view.projectionWidth = width;
  view.projectionHeight = height;
  await syncGeometryAuthority();
  if (view.effectiveGeometryRole !== "authority") {
    return;
  }
  const nextGrid = resolveViewportGrid();
  if (!nextGrid) {
    return;
  }
  if (lastCommittedGrid?.cols === nextGrid.cols && lastCommittedGrid.rows === nextGrid.rows) {
    return;
  }
  await postProductEvent({ type: "resize", cols: nextGrid.cols, rows: nextGrid.rows });
  if (view.requestViewportResize(nextGrid)) {
    lastCommittedGrid = nextGrid;
    scheduleProductFactsRefresh();
    return;
  }
  lastCommittedGrid = null;
  window.setTimeout(scheduleViewportProjectionSync, 50);
};

const scheduleViewportProjectionSync = (): void => {
  if (resizeFrame !== 0) {
    cancelAnimationFrame(resizeFrame);
  }
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0;
    void syncViewportProjection();
  });
};

window.addEventListener("focus", () => {
  view.focus();
  void syncGeometryAuthority();
});
window.addEventListener("pagehide", releaseGeometryAuthority);
window.addEventListener("beforeunload", releaseGeometryAuthority);

window.addEventListener("resize", scheduleViewportProjectionSync);
const viewportObserver = new ResizeObserver(() => {
  scheduleViewportProjectionSync();
});
viewportObserver.observe(root);
view.addEventListener("terminal-view-screen-metrics", scheduleViewportProjectionSync);
view.addEventListener("terminal-view-presentation-ready", () => {
  scheduleViewportProjectionSync();
  scheduleProductFactsRefresh();
});
view.addEventListener("terminal-view-geometry-authority", scheduleViewportProjectionSync);

queueMicrotask(() => {
  view.focus();
  void refreshPermissionRequests();
  void syncGeometryAuthority().then(() => {
    scheduleViewportProjectionSync();
  });
});

void fetch(config.snapshotUrl)
  .then(async (response) => {
    if (!response.ok) {
      throw new Error(\`failed to load cli-shell snapshot: \${response.status}\`);
    }
    return await response.json();
  })
  .then((snapshot) => {
    view.snapshot = snapshot;
    scheduleViewportProjectionSync();
    scheduleProductFactsRefresh();
  })
  .catch((error: unknown) => {
    console.warn(error instanceof Error ? error.message : "failed to load cli-shell snapshot");
  });

window.setInterval(() => {
  scheduleProductFactsRefresh();
  void refreshPermissionRequests();
}, 250);
`,
    "utf8",
  );
};

const createCliShellWebViteServer = async (input: {
  tempDir: string;
  requestedPort: number;
  geometryAuthority: CliShellWebGeometryAuthorityAdapterState;
  productHost: CliShellWebProductHost;
  terminalEntry: GlobalTerminalEntry;
  store: CliShellProductHostStore;
  currentTerminalId: string;
}): Promise<import("vite").ViteDevServer> => {
  const { createServer } = await import("vite");
  type InlineConfig = import("vite").InlineConfig;
  const viteConfig: InlineConfig = {
    configFile: false,
    appType: "spa",
    root: input.tempDir,
    plugins: [
      {
        name: "cli-shell-web-geometry-authority",
        configureServer(server) {
          server.middlewares.use(async (request, response, next) => {
            const requestUrl = request.url ? new URL(request.url, "http://127.0.0.1") : null;
            if (request.method === "POST" && requestUrl?.pathname === CLI_SHELL_WEB_GEOMETRY_AUTHORITY_CLAIM_PATH) {
              try {
                const body = await readJsonBody(request);
                const pageId = normalizeGeometryAuthorityPageId((body as { pageId?: unknown } | null)?.pageId);
                if (!pageId) {
                  writeJsonResponse(response, 400, { error: "pageId is required" });
                  return;
                }
                writeJsonResponse(response, 200, claimCliShellWebGeometryAuthority(input.geometryAuthority, pageId));
              } catch (error) {
                writeJsonResponse(response, 400, {
                  error: error instanceof Error ? error.message : "invalid geometry authority claim payload",
                });
              }
              return;
            }
            if (request.method === "POST" && requestUrl?.pathname === CLI_SHELL_WEB_GEOMETRY_AUTHORITY_RELEASE_PATH) {
              try {
                const body = await readJsonBody(request);
                const pageId = normalizeGeometryAuthorityPageId((body as { pageId?: unknown } | null)?.pageId);
                if (pageId) {
                  void pageId;
                  writeJsonResponse(response, 200, releaseCliShellWebGeometryAuthority());
                  return;
                }
                writeJsonResponse(response, 200, { requestedGeometryRole: "projection-only" });
              } catch (error) {
                writeJsonResponse(response, 400, {
                  error: error instanceof Error ? error.message : "invalid geometry authority release payload",
                });
              }
              return;
            }
            if (request.method === "GET" && requestUrl?.pathname === "/terminal-snapshot.json") {
              input.productHost.renderNow();
              writeJsonResponse(
                response,
                200,
                toSnapshotPayloadFromProductHost(input.productHost, input.terminalEntry),
              );
              return;
            }
            if (request.method === "GET" && requestUrl?.pathname === CLI_SHELL_WEB_APP_STATE_PATH) {
              input.productHost.renderNow();
              const snapshot = input.productHost.getSnapshot();
              writeJsonResponse(response, 200, {
                surface: snapshot.surface,
                model: snapshot.model,
                textEvidence: snapshot.textEvidence,
              });
              return;
            }
            if (request.method === "GET" && requestUrl?.pathname === CLI_SHELL_WEB_PERMISSION_REQUESTS_PATH) {
              const items = await input.store.hydrateGlobalTerminalApprovals({
                terminalId: input.currentTerminalId,
                force: true,
              });
              writeJsonResponse(response, 200, { terminalId: input.currentTerminalId, items });
              return;
            }
            if (request.method === "POST" && requestUrl?.pathname === CLI_SHELL_WEB_APPROVAL_ACTION_PATH) {
              try {
                const body = await readJsonBody(request);
                if (!isCliShellWebApprovalActionPayload(body)) {
                  writeJsonResponse(response, 400, { error: "invalid cli-shell terminal approval action" });
                  return;
                }
                if (body.terminalId !== input.currentTerminalId) {
                  writeJsonResponse(response, 400, {
                    error: "approval action terminal does not match current terminal",
                  });
                  return;
                }
                const result =
                  body.action === "approve"
                    ? await input.store.approveGlobalTerminalRequest({
                        terminalId: body.terminalId,
                        requestId: body.requestId,
                        durationMs: body.durationMs ?? 30 * 60 * 1000,
                      })
                    : await input.store.denyGlobalTerminalRequest({
                        terminalId: body.terminalId,
                        requestId: body.requestId,
                      });
                writeJsonResponse(response, 200, result);
              } catch (error) {
                writeJsonResponse(response, 400, {
                  error: error instanceof Error ? error.message : "invalid cli-shell terminal approval action payload",
                });
              }
              return;
            }
            if (request.method === "POST" && requestUrl?.pathname === CLI_SHELL_WEB_APP_EVENT_PATH) {
              try {
                const body = await readJsonBody(request);
                if (!isCliShellWebProductHostAction(body)) {
                  writeJsonResponse(response, 400, { error: "invalid cli-shell app event" });
                  return;
                }
                await input.productHost.dispatch(body);
                writeJsonResponse(response, 200, input.productHost.getSnapshot());
              } catch (error) {
                writeJsonResponse(response, 400, {
                  error: error instanceof Error ? error.message : "invalid cli-shell app event payload",
                });
              }
              return;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@agenter/terminal-view": TERMINAL_VIEW_SOURCE_PATH,
        "@agenter/terminal-transport-protocol": TERMINAL_TRANSPORT_PROTOCOL_SOURCE_PATH,
      },
    },
    server: {
      host: "127.0.0.1",
      port: input.requestedPort,
      strictPort: false,
      hmr: false,
      fs: {
        allow: [
          input.tempDir,
          resolve(import.meta.dir, "../../../../"),
          resolve(import.meta.dir, "../../../../node_modules/.bun"),
          resolve(import.meta.dir, "../../../../../"),
        ],
      },
    },
    optimizeDeps: {
      exclude: ["@agenter/terminal-view", "@agenter/terminal-transport-protocol"],
    },
  };
  const server = await createServer(viteConfig);
  await server.listen();
  return server;
};

const createWebHostTempDir = async (): Promise<string> => {
  const tempDir = await mkdtemp(join(tmpdir(), "agenter-cli-shell-web-host-"));
  return tempDir;
};

const resolveServerUrl = (server: import("vite").ViteDevServer): string => {
  const localUrl = server.resolvedUrls?.local[0];
  if (localUrl) {
    return localUrl;
  }
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error("vite server missing local address");
  }
  return `http://127.0.0.1:${address.port}/`;
};

const renderHostHtml = (input: {
  terminalId: string;
  transportUrl: string;
  snapshotUrl: string;
  productStateUrl: string;
  productEventUrl: string;
  permissionRequestsUrl: string;
  approvalActionUrl: string;
  requestedGeometryRole: "projection-only" | "authority";
  geometryAuthority: CliShellBrowserHostConfig["geometryAuthority"];
  rendererPreference: "auto" | "ghostty-web" | "wterm" | "xterm";
}): string =>
  buildHostHtml({
    config: {
      terminalId: input.terminalId,
      transportUrl: input.transportUrl,
      snapshotUrl: input.snapshotUrl,
      productStateUrl: input.productStateUrl,
      productEventUrl: input.productEventUrl,
      permissionRequestsUrl: input.permissionRequestsUrl,
      approvalActionUrl: input.approvalActionUrl,
      requestedGeometryRole: input.requestedGeometryRole,
      geometryAuthority: input.geometryAuthority,
      rendererPreference: input.rendererPreference,
    },
  });

export interface CliShellWebHostStartInput {
  store: CliShellProductHostStore;
  shellName?: string;
  attached: CliShellBootstrapResult;
  requestedPort: number;
  debug?: boolean;
  debugFilters?: readonly string[];
  experimentalDynamicRefresh?: boolean;
}

export interface CliShellWebHostController {
  readonly url: string;
  readonly finished: Promise<void>;
  stop(): Promise<void>;
}

export const startCliShellWebHost = async (input: CliShellWebHostStartInput): Promise<CliShellWebHostController> => {
  const terminalId = input.attached.visibleTerminal.entry.terminalId;
  const terminalEntry = await requireTerminalEntry(input.store, terminalId);
  const transportUrl = requireTerminalTransportUrl(terminalEntry);
  const geometryAuthority = createCliShellWebGeometryAuthorityAdapterState(input.attached.visibleTerminal.created);
  const requestedGeometryRole: "projection-only" | "authority" = "projection-only";
  const rendererPreference = terminalEntry.rendererPreference ?? "auto";
  const tempDir = await createWebHostTempDir();
  const snapshotUrl = "/terminal-snapshot.json";
  const productStateUrl = CLI_SHELL_WEB_APP_STATE_PATH;
  const productEventUrl = CLI_SHELL_WEB_APP_EVENT_PATH;
  const permissionRequestsUrl = CLI_SHELL_WEB_PERMISSION_REQUESTS_PATH;
  const approvalActionUrl = CLI_SHELL_WEB_APPROVAL_ACTION_PATH;
  const settingsFile = await input.store.readSettings(input.attached.session.id, "settings").catch(() => null);
  const keybindings = resolveCliShellTuiKeybindings(settingsFile?.content);
  await input.store.connect();
  await input.store.hydrateSessionArtifacts(input.attached.session.id, {
    includeChatHistory: false,
    observabilityMode: "heartbeat",
  });
  const productHost = startCliShellWebProductHost({
    store: input.store,
    shellName: input.shellName ?? input.attached.visibleTerminal.entry.terminalId.replace(/:terminal-2$/, ""),
    attached: input.attached,
    keybindings,
    debug: input.debug ?? false,
    debugFilters: input.debugFilters,
    experimentalDynamicRefresh: input.experimentalDynamicRefresh ?? true,
    initialCols: terminalEntry.snapshot?.cols ?? 80,
    initialRows: terminalEntry.snapshot?.rows ?? 24,
  });
  productHost.start();
  const releasePermissionRequests = input.store.retainTerminalPermissionRequests({ terminalId });
  await writeFile(
    join(tempDir, "index.html"),
    renderHostHtml({
      terminalId,
      transportUrl,
      snapshotUrl,
      productStateUrl,
      productEventUrl,
      permissionRequestsUrl,
      approvalActionUrl,
      requestedGeometryRole,
      geometryAuthority: {
        enabled: geometryAuthority.enabled,
        claimUrl: CLI_SHELL_WEB_GEOMETRY_AUTHORITY_CLAIM_PATH,
        releaseUrl: CLI_SHELL_WEB_GEOMETRY_AUTHORITY_RELEASE_PATH,
        geometryOrder: geometryAuthority.geometryOrder,
      },
      rendererPreference,
    }),
    "utf8",
  );
  await writeBrowserHostFiles(tempDir);
  const viteServer = await createCliShellWebViteServer({
    tempDir,
    requestedPort: input.requestedPort,
    geometryAuthority,
    productHost,
    terminalEntry,
    store: input.store,
    currentTerminalId: terminalId,
  });
  const resolvedUrl = resolveServerUrl(viteServer);
  let stopped = false;
  const httpServer = viteServer.httpServer as
    | {
        closeAllConnections?: () => void;
        closeIdleConnections?: () => void;
      }
    | undefined;
  return {
    url: resolvedUrl,
    finished: new Promise<void>(() => undefined),
    async stop(): Promise<void> {
      if (stopped) {
        return;
      }
      stopped = true;
      releasePermissionRequests();
      productHost.dispose();
      input.store.disconnect();
      viteServer.ws.close();
      httpServer?.closeAllConnections?.();
      httpServer?.closeIdleConnections?.();
      await Promise.race([
        viteServer.close(),
        new Promise<void>((resolve) => {
          setTimeout(resolve, 2_000);
        }),
      ]);
      httpServer?.closeAllConnections?.();
      await rm(tempDir, { recursive: true, force: true });
    },
  };
};

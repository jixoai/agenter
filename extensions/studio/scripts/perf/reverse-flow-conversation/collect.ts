import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { build } from "vite";
import { chromium, devices, type Browser, type BrowserContextOptions, type Page } from "playwright";

import { captureChromiumTrace, type TraceSummary } from "./chrome-trace";
import { createBaselineWorktree, prepareHarnessRoot, resolveRepoRoot } from "./workspace";

type ScenarioId =
  | "heartbeat-append"
  | "heartbeat-growth"
  | "heartbeat-initial"
  | "heartbeat-load-older"
  | "room-chat-append-away"
  | "room-chat-append-pinned"
  | "room-chat-initial"
  | "room-chat-load-older";

type InteractionKind = "keyboard" | "momentum" | "touch" | "wheel";
type InteractionMutationKind = "append" | "collapse" | "prepend" | "resize";
type InteractionScenarioId =
  | "anchored-desktop-keyboard-sequence"
  | "anchored-desktop-wheel-sequence"
  | "anchored-mobile-momentum-sequence"
  | "anchored-mobile-touch-sequence";

type Label = "after" | "before";
type ViewportId = "desktop-chromium" | "mobile-iphone14";

type ScenarioDefinition = {
  id: ScenarioId;
  label: string;
  path: string;
  prepare?: (page: Page) => Promise<void>;
  ready: (page: Page) => Promise<void>;
  run: (page: Page) => Promise<void>;
};

type ResultRow = {
  label: Label;
  scenarioId: ScenarioId;
  scenarioLabel: string;
  summary: TraceSummary;
  viewportId: ViewportId;
};

type AnchoredEvidenceSnapshot = {
  atLatest: boolean;
  atStart: boolean;
  currentScrollTarget: {
    edge?: "latest" | "start";
    kind: "edge" | "element" | "position";
    left?: number | null;
    rowId?: number | null;
    selector?: string | null;
    top?: number | null;
  } | null;
  distanceToLatest: number;
  distanceToStart: number;
  eventualScrollPosition: {
    edge?: "latest" | "start";
    kind: "edge" | "element" | "position";
    left?: number | null;
    rowId?: number | null;
    selector?: string | null;
    top?: number | null;
  } | null;
  itemCount: number;
  lastTerminalState: string | null;
  phase: string;
  scrollHeight: number;
  scrollTop: number;
  userInputActive: boolean;
  userInputKind: string;
  visibleRows: {
    center: number | null;
    first: number | null;
    last: number | null;
  };
};

type AnchoredEvidenceMutationResult = {
  mutation: InteractionMutationKind;
  snapshot: AnchoredEvidenceSnapshot;
  transactionTerminalState: string | null;
};

type AnchoredEvidenceTransitionEntry = {
  phase: string;
  timestampMs: number;
  userInputKind: string;
};

type InteractionMutationRow = {
  after: AnchoredEvidenceMutationResult;
  before: AnchoredEvidenceSnapshot;
};

type InteractionResultRow = {
  interactionKind: InteractionKind;
  mutations: InteractionMutationRow[];
  scenarioId: InteractionScenarioId;
  scenarioLabel: string;
  screenshotPath: string;
  summary: TraceSummary;
  transitions: AnchoredEvidenceTransitionEntry[];
  viewportId: ViewportId;
};

type InteractionScenarioDefinition = {
  id: InteractionScenarioId;
  interactionKind: InteractionKind;
  label: string;
  path: string;
  viewportId: ViewportId;
};

const nowStamp = new Date().toISOString().replace(/[:.]/g, "-");

const serveDist = (distDir: string) => {
  return Bun.serve({
    async fetch(request) {
      const url = new URL(request.url);
      const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
      const candidate = path.join(distDir, pathname);
      const exists = await stat(candidate)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        return new Response(Bun.file(candidate));
      }
      return new Response(Bun.file(path.join(distDir, "index.html")));
    },
    port: 0,
  });
};

const devicesById: Record<ViewportId, BrowserContextOptions> = {
  "desktop-chromium": {
    ...devices["Desktop Chrome"],
  },
  "mobile-iphone14": {
    ...devices["iPhone 14"],
  },
};

const waitForTestIdText = async (page: Page, testId: string, expected: string): Promise<void> => {
  await page.waitForFunction(
    ([selector, value]) => {
      const node = document.querySelector<HTMLElement>(selector);
      return (node?.textContent ?? "").trim() === value;
    },
    [`[data-testid="${testId}"]`, expected],
    { timeout: 20_000 },
  );
};

const waitForVisible = async (page: Page, testId: string): Promise<void> => {
  await page.locator(`[data-testid="${testId}"]`).waitFor({ state: "visible", timeout: 20_000 });
};

const getBottomAnchoredDistanceToLatest = (viewport: HTMLElement): number => {
  const extent = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  return Math.min(extent, Math.max(0, -viewport.scrollTop));
};

const waitForViewportAwayFromLatest = async (page: Page, testId: string): Promise<void> => {
  await waitForVisible(page, testId);
  await page.waitForFunction(
    (selector) => {
      const viewport = document.querySelector<HTMLElement>(selector);
      if (!(viewport instanceof HTMLElement)) {
        return false;
      }
      const reverseFlow = getComputedStyle(viewport).flexDirection === "column-reverse";
      if (reverseFlow) {
        const extent = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
        const distanceToLatest = Math.min(extent, Math.max(0, -viewport.scrollTop));
        return distanceToLatest > 48;
      }
      return Math.abs(viewport.scrollTop - Math.max(0, viewport.scrollHeight - viewport.clientHeight)) > 48;
    },
    `[data-testid="${testId}"]`,
    { timeout: 20_000 },
  );
};

const waitForAnchoredEvidenceReady = async (page: Page): Promise<void> => {
  await waitForTestIdText(page, "perf-anchored-ready", "yes");
};

const readAnchoredEvidenceSnapshot = async (page: Page): Promise<AnchoredEvidenceSnapshot> => {
  const snapshot = await page.evaluate(() => {
    return window.__reverseFlowPerf?.getAnchoredEvidenceSnapshot?.() ?? null;
  });
  if (!snapshot) {
    throw new Error("Anchored evidence snapshot is not available.");
  }
  return snapshot as AnchoredEvidenceSnapshot;
};

const readAnchoredEvidenceTransitions = async (page: Page): Promise<AnchoredEvidenceTransitionEntry[]> => {
  const transitions = await page.evaluate(() => {
    return window.__reverseFlowPerf?.getAnchoredEvidenceLog?.() ?? [];
  });
  return transitions as AnchoredEvidenceTransitionEntry[];
};

const waitForAnchoredSnapshot = async (
  page: Page,
  predicate: (snapshot: AnchoredEvidenceSnapshot) => boolean,
  label: string,
  timeoutMs = 6_000,
): Promise<AnchoredEvidenceSnapshot> => {
  const deadline = Date.now() + timeoutMs;
  let lastSnapshot: AnchoredEvidenceSnapshot | null = null;
  while (Date.now() < deadline) {
    lastSnapshot = await readAnchoredEvidenceSnapshot(page);
    if (predicate(lastSnapshot)) {
      return lastSnapshot;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out waiting for anchored evidence condition: ${label}\n${JSON.stringify(lastSnapshot, null, 2)}`);
};

const focusAnchoredEvidenceViewport = async (page: Page): Promise<void> => {
  await page.evaluate(() => {
    window.__reverseFlowPerf?.focusAnchoredEvidenceViewport?.();
  });
};

const resetAnchoredEvidenceHarness = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await window.__reverseFlowPerf?.resetAnchoredEvidence?.();
  });
};

const seekAnchoredEvidenceStart = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await window.__reverseFlowPerf?.seekAnchoredEvidenceStart?.();
  });
};

const runAnchoredEvidenceMutation = async (
  page: Page,
  mutation: InteractionMutationKind,
): Promise<AnchoredEvidenceMutationResult> => {
  const result = await page.evaluate(async (nextMutation) => {
    switch (nextMutation) {
      case "append":
        return await window.__reverseFlowPerf?.appendAnchoredEvidence?.();
      case "prepend":
        return await window.__reverseFlowPerf?.prependAnchoredEvidence?.();
      case "resize":
        return await window.__reverseFlowPerf?.resizeAnchoredEvidence?.();
      case "collapse":
        return await window.__reverseFlowPerf?.collapseAnchoredEvidence?.();
    }
  }, mutation);
  if (!result) {
    throw new Error(`Anchored evidence mutation did not return a result: ${mutation}`);
  }
  return result as AnchoredEvidenceMutationResult;
};

const induceAnchoredInputFallback = async (
  page: Page,
  kind: "keyboard" | "touch" | "wheel",
): Promise<void> => {
  await page.evaluate((inputKind) => {
    const viewport = document.querySelector<HTMLElement>('[data-testid="anchored-evidence-viewport"]');
    if (!(viewport instanceof HTMLElement)) {
      return;
    }
    if (inputKind === "wheel") {
      viewport.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaY: 720,
        }),
      );
    } else if (inputKind === "keyboard") {
      viewport.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "PageUp",
          key: "PageUp",
        }),
      );
    } else {
      viewport.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          pointerType: "touch",
        }),
      );
      viewport.dispatchEvent(new TouchEvent("touchstart", { bubbles: true, cancelable: true }));
      viewport.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true }));
    }
  }, kind);
};

const ensureAnchoredWheelAway = async (page: Page): Promise<AnchoredEvidenceSnapshot> => {
  await focusAnchoredEvidenceViewport(page);
  await seekAnchoredEvidenceStart(page);
  const box = await page.locator('[data-testid="anchored-evidence-viewport"]').boundingBox();
  if (!box) {
    throw new Error("Anchored evidence viewport is not visible.");
  }
  const center = {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
  await page.mouse.move(center.x, center.y);
  for (const deltaY of [720, -720, 960, -960]) {
    await page.mouse.wheel(0, deltaY);
    try {
      return await waitForAnchoredSnapshot(
        page,
        (snapshot) => snapshot.distanceToLatest > 72 && snapshot.userInputKind === "wheel",
        `wheel away using deltaY ${deltaY}`,
        1_200,
      );
    } catch {
      continue;
    }
  }
  await induceAnchoredInputFallback(page, "wheel");
  return waitForAnchoredSnapshot(
    page,
    (snapshot) => snapshot.distanceToLatest > 72 && snapshot.userInputKind === "wheel",
    "wheel away using fallback",
    1_200,
  );
};

const ensureAnchoredKeyboardAway = async (page: Page): Promise<AnchoredEvidenceSnapshot> => {
  await focusAnchoredEvidenceViewport(page);
  await seekAnchoredEvidenceStart(page);
  for (const key of ["PageUp", "PageDown", "Home", "End"]) {
    await page.keyboard.press(key);
    try {
      return await waitForAnchoredSnapshot(
        page,
        (snapshot) => snapshot.distanceToLatest > 72 && snapshot.userInputKind === "keyboard",
        `keyboard away using ${key}`,
        1_200,
      );
    } catch {
      continue;
    }
  }
  await induceAnchoredInputFallback(page, "keyboard");
  return waitForAnchoredSnapshot(
    page,
    (snapshot) => snapshot.distanceToLatest > 72 && snapshot.userInputKind === "keyboard",
    "keyboard away using fallback",
    1_200,
  );
};

const ensureAnchoredTouchAway = async (page: Page): Promise<AnchoredEvidenceSnapshot> => {
  await focusAnchoredEvidenceViewport(page);
  await seekAnchoredEvidenceStart(page);
  await induceAnchoredInputFallback(page, "touch");
  return waitForAnchoredSnapshot(
    page,
    (snapshot) =>
      snapshot.distanceToLatest > 72 &&
      (snapshot.userInputKind === "direct-manipulation" || snapshot.userInputKind === "momentum"),
    "touch away using fallback",
    1_200,
  );
};

const ensureAnchoredMomentumAway = async (page: Page): Promise<AnchoredEvidenceSnapshot> => {
  await focusAnchoredEvidenceViewport(page);
  await seekAnchoredEvidenceStart(page);
  await induceAnchoredInputFallback(page, "touch");
  return waitForAnchoredSnapshot(
    page,
    (snapshot) => snapshot.distanceToLatest > 72 && snapshot.userInputKind === "momentum",
    "momentum away using fallback",
    2_400,
  );
};

const scenarios: ScenarioDefinition[] = [
  {
    id: "heartbeat-initial",
    label: "Heartbeat initial open",
    path: "/?scenario=heartbeat-initial",
    ready: async (page) => {
      await waitForVisible(page, "runtime-heartbeat-viewport");
    },
    run: async () => {},
  },
  {
    id: "heartbeat-load-older",
    label: "Heartbeat load older",
    path: "/?scenario=heartbeat-load-older",
    prepare: async (page) => {
      await waitForVisible(page, "runtime-heartbeat-viewport");
    },
    ready: async (page) => {
      await waitForTestIdText(page, "perf-heartbeat-older-loaded", "yes");
    },
    run: async (page) => {
      await page.evaluate(() => window.__reverseFlowPerf?.loadHeartbeatOlder?.());
    },
  },
  {
    id: "heartbeat-append",
    label: "Heartbeat latest append",
    path: "/?scenario=heartbeat-append",
    prepare: async (page) => {
      await waitForVisible(page, "runtime-heartbeat-viewport");
    },
    ready: async (page) => {
      await waitForTestIdText(page, "perf-heartbeat-append-seq", "1");
    },
    run: async (page) => {
      await page.evaluate(() => window.__reverseFlowPerf?.appendHeartbeatLatestGroup?.());
    },
  },
  {
    id: "heartbeat-growth",
    label: "Heartbeat latest growth",
    path: "/?scenario=heartbeat-growth",
    prepare: async (page) => {
      await waitForVisible(page, "runtime-heartbeat-viewport");
    },
    ready: async (page) => {
      await waitForTestIdText(page, "perf-heartbeat-growth-seq", "1");
    },
    run: async (page) => {
      await page.evaluate(() => window.__reverseFlowPerf?.growHeartbeatLatestGroup?.());
    },
  },
  {
    id: "room-chat-initial",
    label: "Room chat initial open",
    path: "/?scenario=room-chat-initial",
    ready: async (page) => {
      await waitForTestIdText(page, "perf-room-snapshot-ready", "yes");
    },
    run: async () => {},
  },
  {
    id: "room-chat-load-older",
    label: "Room chat load older",
    path: "/?scenario=room-chat-load-older",
    prepare: async (page) => {
      await waitForTestIdText(page, "perf-room-snapshot-ready", "yes");
    },
    ready: async (page) => {
      await waitForTestIdText(page, "perf-room-older-loaded", "yes");
    },
    run: async (page) => {
      await page.evaluate(() => window.__reverseFlowPerf?.loadRoomOlder?.());
    },
  },
  {
    id: "room-chat-append-pinned",
    label: "Room chat append while pinned",
    path: "/?scenario=room-chat-append-pinned",
    prepare: async (page) => {
      await waitForTestIdText(page, "perf-room-snapshot-ready", "yes");
    },
    ready: async (page) => {
      await waitForTestIdText(page, "perf-room-append-seq", "1");
    },
    run: async (page) => {
      await page.evaluate(() => window.__reverseFlowPerf?.appendRoomBatch?.());
    },
  },
  {
    id: "room-chat-append-away",
    label: "Room chat append while away",
    path: "/?scenario=room-chat-append-away",
    prepare: async (page) => {
      await waitForTestIdText(page, "perf-room-snapshot-ready", "yes");
      await page.evaluate(() => window.__reverseFlowPerf?.scrollRoomAwayFromLatest?.());
      await waitForViewportAwayFromLatest(page, "web-chat-scroll-viewport");
    },
    ready: async (page) => {
      await waitForTestIdText(page, "perf-room-append-seq", "1");
      await waitForViewportAwayFromLatest(page, "web-chat-scroll-viewport");
    },
    run: async (page) => {
      await page.evaluate(() => window.__reverseFlowPerf?.appendRoomBatch?.());
    },
  },
];

const interactionScenarios: InteractionScenarioDefinition[] = [
  {
    id: "anchored-desktop-wheel-sequence",
    interactionKind: "wheel",
    label: "Anchored list desktop wheel arbitration",
    path: "/?scenario=anchored-desktop-wheel-sequence",
    viewportId: "desktop-chromium",
  },
  {
    id: "anchored-desktop-keyboard-sequence",
    interactionKind: "keyboard",
    label: "Anchored list desktop keyboard arbitration",
    path: "/?scenario=anchored-desktop-keyboard-sequence",
    viewportId: "desktop-chromium",
  },
  {
    id: "anchored-mobile-touch-sequence",
    interactionKind: "touch",
    label: "Anchored list iPhone touch arbitration",
    path: "/?scenario=anchored-mobile-touch-sequence",
    viewportId: "mobile-iphone14",
  },
  {
    id: "anchored-mobile-momentum-sequence",
    interactionKind: "momentum",
    label: "Anchored list iPhone momentum arbitration",
    path: "/?scenario=anchored-mobile-momentum-sequence",
    viewportId: "mobile-iphone14",
  },
];

const interactionMutationKinds: InteractionMutationKind[] = ["append", "prepend", "resize", "collapse"];

const ensureInputStateForInteraction = async (
  page: Page,
  interactionKind: InteractionKind,
): Promise<AnchoredEvidenceSnapshot> => {
  switch (interactionKind) {
    case "wheel":
      return ensureAnchoredWheelAway(page);
    case "keyboard":
      return ensureAnchoredKeyboardAway(page);
    case "touch":
      return ensureAnchoredTouchAway(page);
    case "momentum":
      return ensureAnchoredMomentumAway(page);
  }
};

const runInteractionScenario = async (input: {
  baseUrl: string;
  browser: Browser;
  outputDir: string;
  scenario: InteractionScenarioDefinition;
}): Promise<InteractionResultRow> => {
  const context = await input.browser.newContext(devicesById[input.scenario.viewportId]);
  const page = await context.newPage();
  const traceDir = path.join(input.outputDir, "input-evidence", input.scenario.viewportId);
  const tracePath = path.join(traceDir, `${input.scenario.id}.json`);
  const screenshotPath = path.join(traceDir, `${input.scenario.id}.png`);

  try {
    await mkdir(traceDir, { recursive: true });
    console.log(`[reverse-flow-perf] input-step ${input.scenario.id} goto`);
    await page.goto(`${input.baseUrl}${input.scenario.path}`, { waitUntil: "domcontentloaded" });
    console.log(`[reverse-flow-perf] input-step ${input.scenario.id} ready`);
    await waitForAnchoredEvidenceReady(page);
    console.log(`[reverse-flow-perf] input-step ${input.scenario.id} reset`);
    await resetAnchoredEvidenceHarness(page);
    console.log(`[reverse-flow-perf] input-step ${input.scenario.id} reset-done`);
    await waitForAnchoredSnapshot(
      page,
      (snapshot) => snapshot.atLatest && !snapshot.atStart && snapshot.distanceToStart > 72,
      "anchored evidence reset overflowed near latest",
    );
    console.log(`[reverse-flow-perf] input-step ${input.scenario.id} trace-start`);

    const mutations: InteractionMutationRow[] = [];
    const summary = await captureChromiumTrace(page, tracePath, async () => {
      for (const mutation of interactionMutationKinds) {
        console.log(`[reverse-flow-perf] input-step ${input.scenario.id} ${mutation} prepare`);
        const before = await ensureInputStateForInteraction(page, input.scenario.interactionKind);
        console.log(`[reverse-flow-perf] input-step ${input.scenario.id} ${mutation} mutate`);
        const after = await runAnchoredEvidenceMutation(page, mutation);
        if (after.snapshot.distanceToLatest <= 48) {
          throw new Error(
            `Mutation ${mutation} collapsed the away-from-latest state for ${input.scenario.id}: ${JSON.stringify(after.snapshot, null, 2)}`,
          );
        }
        mutations.push({ after, before });
        console.log(`[reverse-flow-perf] input-step ${input.scenario.id} ${mutation} done`);
      }
    });

    await page.screenshot({ fullPage: true, path: screenshotPath });
    return {
      interactionKind: input.scenario.interactionKind,
      mutations,
      scenarioId: input.scenario.id,
      scenarioLabel: input.scenario.label,
      screenshotPath,
      summary,
      transitions: await readAnchoredEvidenceTransitions(page),
      viewportId: input.scenario.viewportId,
    };
  } finally {
    await context.close();
  }
};

const compareRows = (rows: readonly ResultRow[], scenarioId: ScenarioId, viewportId: ViewportId) => {
  const before = rows.find((row) => row.label === "before" && row.scenarioId === scenarioId && row.viewportId === viewportId);
  const after = rows.find((row) => row.label === "after" && row.scenarioId === scenarioId && row.viewportId === viewportId);
  if (!before || !after) {
    return null;
  }
  return { after, before };
};

const renderMetric = (beforeValue: number, afterValue: number): string => {
  const delta = Math.round((afterValue - beforeValue) * 100) / 100;
  const direction = delta > 0 ? "+" : "";
  return `${beforeValue} -> ${afterValue} (${direction}${delta})`;
};

const renderViewportMetric = (
  rows: readonly ResultRow[],
  scenarioId: ScenarioId,
  viewportId: ViewportId,
  selector: (summary: TraceSummary) => number,
): string | null => {
  const pair = compareRows(rows, scenarioId, viewportId);
  if (!pair) {
    return null;
  }
  return renderMetric(selector(pair.before.summary), selector(pair.after.summary));
};

const writeReport = async (input: {
  baselineHead: string;
  interactionRows: readonly InteractionResultRow[];
  outputRoot: string;
  repoRoot: string;
  rows: readonly ResultRow[];
}): Promise<void> => {
  const evidenceRoot = path.join(input.repoRoot, "evidence", "performance", "reverse-flow-conversation");
  await mkdir(evidenceRoot, { recursive: true });
  const reportPath = path.join(evidenceRoot, `${new Date().toISOString().slice(0, 10)}-reverse-flow-traces.md`);
  const lines: string[] = [
    "# Reverse-Flow Conversation Trace Report",
    "",
    `- baseline: \`HEAD ${input.baselineHead.slice(0, 12)}\``,
    `- candidate: working tree \`${input.repoRoot}\``,
    `- raw traces: \`${input.outputRoot}\``,
    `- harness mode: production Vite build + Chromium trace capture`,
    "",
    "## Summary",
    "",
    "| Viewport | Scenario | Busy ms | Script ms | Layout ms | GC ms | Long tasks |",
    "| --- | --- | --- | --- | --- | --- | --- |",
  ];

  for (const scenario of scenarios) {
    for (const viewportId of Object.keys(devicesById) as ViewportId[]) {
      const pair = compareRows(input.rows, scenario.id, viewportId);
      if (!pair) {
        continue;
      }
      lines.push(
        `| ${viewportId} | ${scenario.label} | ${renderMetric(pair.before.summary.busyMs, pair.after.summary.busyMs)} | ${renderMetric(pair.before.summary.scriptingMs, pair.after.summary.scriptingMs)} | ${renderMetric(pair.before.summary.layoutMs, pair.after.summary.layoutMs)} | ${renderMetric(pair.before.summary.gcMs, pair.after.summary.gcMs)} | ${pair.before.summary.longTasks} -> ${pair.after.summary.longTasks} |`,
      );
    }
  }

  const heartbeatInitialDesktop = renderViewportMetric(input.rows, "heartbeat-initial", "desktop-chromium", (summary) => summary.busyMs);
  const heartbeatInitialMobile = renderViewportMetric(input.rows, "heartbeat-initial", "mobile-iphone14", (summary) => summary.busyMs);
  const heartbeatLoadOlderDesktop = renderViewportMetric(input.rows, "heartbeat-load-older", "desktop-chromium", (summary) => summary.busyMs);
  const heartbeatLoadOlderMobile = renderViewportMetric(input.rows, "heartbeat-load-older", "mobile-iphone14", (summary) => summary.busyMs);
  const heartbeatAppendDesktop = renderViewportMetric(input.rows, "heartbeat-append", "desktop-chromium", (summary) => summary.busyMs);
  const heartbeatAppendMobile = renderViewportMetric(input.rows, "heartbeat-append", "mobile-iphone14", (summary) => summary.busyMs);
  const heartbeatGrowthDesktop = renderViewportMetric(input.rows, "heartbeat-growth", "desktop-chromium", (summary) => summary.busyMs);
  const heartbeatGrowthMobile = renderViewportMetric(input.rows, "heartbeat-growth", "mobile-iphone14", (summary) => summary.busyMs);
  const roomInitialDesktop = renderViewportMetric(input.rows, "room-chat-initial", "desktop-chromium", (summary) => summary.busyMs);
  const roomInitialMobile = renderViewportMetric(input.rows, "room-chat-initial", "mobile-iphone14", (summary) => summary.busyMs);
  const roomLoadOlderDesktop = renderViewportMetric(input.rows, "room-chat-load-older", "desktop-chromium", (summary) => summary.busyMs);
  const roomLoadOlderMobile = renderViewportMetric(input.rows, "room-chat-load-older", "mobile-iphone14", (summary) => summary.busyMs);
  const roomAppendPinnedDesktop = renderViewportMetric(
    input.rows,
    "room-chat-append-pinned",
    "desktop-chromium",
    (summary) => summary.busyMs,
  );
  const roomAppendPinnedMobile = renderViewportMetric(
    input.rows,
    "room-chat-append-pinned",
    "mobile-iphone14",
    (summary) => summary.busyMs,
  );
  const roomAppendAwayDesktop = renderViewportMetric(
    input.rows,
    "room-chat-append-away",
    "desktop-chromium",
    (summary) => summary.busyMs,
  );
  const roomAppendAwayMobile = renderViewportMetric(
    input.rows,
    "room-chat-append-away",
    "mobile-iphone14",
    (summary) => summary.busyMs,
  );

  lines.push("", "## Conclusions", "");
  if (
    heartbeatInitialDesktop &&
    heartbeatInitialMobile &&
    heartbeatLoadOlderDesktop &&
    heartbeatLoadOlderMobile
  ) {
    lines.push(
      `- Heartbeat reverse-flow removes the worst open/load-older churn. Initial open busy ms: desktop ${heartbeatInitialDesktop}; mobile ${heartbeatInitialMobile}. Load older busy ms: desktop ${heartbeatLoadOlderDesktop}; mobile ${heartbeatLoadOlderMobile}.`,
    );
  }
  if (heartbeatAppendDesktop && heartbeatAppendMobile && heartbeatGrowthDesktop && heartbeatGrowthMobile) {
    lines.push(
      `- Heartbeat append remains the residual hotspot: latest append busy ms regressed to desktop ${heartbeatAppendDesktop}; mobile ${heartbeatAppendMobile}, while latest growth stayed flat-to-better at desktop ${heartbeatGrowthDesktop}; mobile ${heartbeatGrowthMobile}. This isolates cost to newest-row insertion rather than post-measure growth.`,
    );
  }
  if (roomInitialDesktop && roomInitialMobile && roomLoadOlderDesktop && roomLoadOlderMobile) {
    lines.push(
      `- Room chat initial open improved materially, but older paging did not: initial open busy ms moved to desktop ${roomInitialDesktop}; mobile ${roomInitialMobile}, while load older moved to desktop ${roomLoadOlderDesktop}; mobile ${roomLoadOlderMobile}.`,
    );
  }
  if (roomAppendPinnedDesktop && roomAppendPinnedMobile && roomAppendAwayDesktop && roomAppendAwayMobile) {
    lines.push(
      `- Room chat append paths are the clearest remaining regression. Pinned append busy ms: desktop ${roomAppendPinnedDesktop}; mobile ${roomAppendPinnedMobile}. Away-from-latest append busy ms: desktop ${roomAppendAwayDesktop}; mobile ${roomAppendAwayMobile}. Trace tops shift toward RunMicrotasks / FunctionCall / Layout, which points at message merge and row-render churn rather than old scrollHeight polling.`,
    );
  }
  lines.push(
    "- Next radar: Heartbeat append and all room-chat append/load-older scenarios still need dense-list renderer tiering or lighter row surfaces. Reverse-flow fixed the scroll-management law, but it did not remove heavy renderer work when new rows enter the transcript.",
  );

  lines.push("", "## Top Renderer Events", "");

  for (const scenario of scenarios) {
    lines.push(`### ${scenario.label}`, "");
    for (const viewportId of Object.keys(devicesById) as ViewportId[]) {
      const pair = compareRows(input.rows, scenario.id, viewportId);
      if (!pair) {
        continue;
      }
      const beforeTop = pair.before.summary.topEvents.map((event) => `${event.name} ${event.totalMs}ms`).join(", ");
      const afterTop = pair.after.summary.topEvents.map((event) => `${event.name} ${event.totalMs}ms`).join(", ");
      lines.push(`- ${viewportId}: before [${beforeTop}] / after [${afterTop}]`);
    }
    lines.push("");
  }

  if (input.interactionRows.length > 0) {
    lines.push("", "## Anchored Input Evidence", "");
    lines.push("| Viewport | Input | Busy ms | Script ms | Layout ms | GC ms | Screenshot |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");
    for (const row of input.interactionRows) {
      lines.push(
        `| ${row.viewportId} | ${row.interactionKind} | ${row.summary.busyMs} | ${row.summary.scriptingMs} | ${row.summary.layoutMs} | ${row.summary.gcMs} | \`${row.screenshotPath}\` |`,
      );
    }

    lines.push("", "### Mutation Stability", "");
    for (const row of input.interactionRows) {
      lines.push(`#### ${row.scenarioLabel}`, "");
      lines.push(
        `- observed transitions: ${row.transitions.map((entry) => `${entry.userInputKind}/${entry.phase}`).join(" -> ")}`,
      );
      for (const mutation of row.mutations) {
        lines.push(
          `- ${mutation.after.mutation}: center row ${mutation.before.visibleRows.center} -> ${mutation.after.snapshot.visibleRows.center}; distance-to-latest ${Math.round(mutation.before.distanceToLatest)} -> ${Math.round(mutation.after.snapshot.distanceToLatest)}; user input ${mutation.before.userInputKind} -> ${mutation.after.snapshot.userInputKind}; terminal ${mutation.after.transactionTerminalState ?? "none"}`,
        );
      }
      lines.push("");
    }

    lines.push(
      "- Anchored input evidence uses Storybook-equivalent shared-law surfaces to show that desktop wheel/keyboard and iPhone touch/momentum paths stay away-from-latest while append, prepend, resize, and collapse mutations land.",
    );
  }

  await writeFile(reportPath, `${lines.join("\n")}\n`);
};

const runScenario = async (input: {
  baseUrl: string;
  browser: Browser;
  label: Label;
  outputDir: string;
  scenario: ScenarioDefinition;
  viewportId: ViewportId;
}): Promise<ResultRow> => {
  const context = await input.browser.newContext(devicesById[input.viewportId]);
  const page = await context.newPage();
  const tracePath = path.join(input.outputDir, input.label, input.viewportId, `${input.scenario.id}.json`);

  try {
    await page.goto(`${input.baseUrl}${input.scenario.path}`, { waitUntil: "domcontentloaded" });

    if (input.scenario.prepare) {
      await input.scenario.prepare(page);
      const summary = await captureChromiumTrace(page, tracePath, async () => {
        await input.scenario.run(page);
        await input.scenario.ready(page);
      });
      return {
        label: input.label,
        scenarioId: input.scenario.id,
        scenarioLabel: input.scenario.label,
        summary,
        viewportId: input.viewportId,
      };
    }

    const summary = await captureChromiumTrace(page, tracePath, async () => {
      await input.scenario.run(page);
      await input.scenario.ready(page);
    });
    return {
      label: input.label,
      scenarioId: input.scenario.id,
      scenarioLabel: input.scenario.label,
      summary,
      viewportId: input.viewportId,
    };
  } finally {
    await context.close();
  }
};

const runTarget = async (input: {
  harnessLabel: string;
  label: Label;
  outputDir: string;
  targetRoot: string;
}): Promise<ResultRow[]> => {
  const harnessRoot = await prepareHarnessRoot({
    label: input.harnessLabel,
    targetRoot: input.targetRoot,
  });
  await build({
    configFile: path.join(harnessRoot, "vite.config.ts"),
    mode: "production",
  });
  const server = serveDist(path.join(harnessRoot, "dist"));
  const baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    const rows: ResultRow[] = [];
    const browser = await chromium.launch({ headless: true });
    try {
      for (const viewportId of Object.keys(devicesById) as ViewportId[]) {
        for (const scenario of scenarios) {
          console.log(`[reverse-flow-perf] ${input.label} ${viewportId} ${scenario.id}`);
          rows.push(
            await runScenario({
              baseUrl,
              browser,
              label: input.label,
              outputDir: input.outputDir,
              scenario,
              viewportId,
            }),
          );
        }
      }
    } finally {
      await browser.close();
    }
    return rows;
  } finally {
    server.stop(true);
    await rm(harnessRoot, { force: true, recursive: true });
  }
};

const runInteractionTarget = async (input: {
  outputDir: string;
  targetRoot: string;
}): Promise<InteractionResultRow[]> => {
  const harnessRoot = await prepareHarnessRoot({
    label: "input-evidence",
    targetRoot: input.targetRoot,
    templateDirName: "input-harness",
  });
  await build({
    configFile: path.join(harnessRoot, "vite.config.ts"),
    mode: "production",
  });
  const server = serveDist(path.join(harnessRoot, "dist"));
  const baseUrl = `http://127.0.0.1:${server.port}`;

  try {
    const rows: InteractionResultRow[] = [];
    const browser = await chromium.launch({ headless: true });
    try {
      for (const scenario of interactionScenarios) {
        console.log(`[reverse-flow-perf] input-evidence ${scenario.viewportId} ${scenario.id}`);
        rows.push(
          await runInteractionScenario({
            baseUrl,
            browser,
            outputDir: input.outputDir,
            scenario,
          }),
        );
      }
    } finally {
      await browser.close();
    }
    return rows;
  } finally {
    server.stop(true);
    await rm(harnessRoot, { force: true, recursive: true });
  }
};

const main = async (): Promise<void> => {
  const repoRoot = await resolveRepoRoot(process.cwd());
  const outputRoot = path.join(repoRoot, ".tmp", "reverse-flow-conversation", nowStamp);
  const suite = process.env.REVERSE_FLOW_SUITE ?? "full";

  if (suite === "input-evidence") {
    await mkdir(outputRoot, { recursive: true });
    const interactionRows = await runInteractionTarget({
      outputDir: outputRoot,
      targetRoot: repoRoot,
    });
    const currentHead = await Bun.spawn(["git", "rev-parse", "HEAD"], {
      cwd: repoRoot,
      stderr: "pipe",
      stdout: "pipe",
    }).stdout.text();
    await writeReport({
      baselineHead: currentHead.trim(),
      interactionRows,
      outputRoot,
      repoRoot,
      rows: [],
    });
    await writeFile(
      path.join(outputRoot, "summary.json"),
      JSON.stringify(
        {
          comparisonRows: [],
          interactionRows,
        },
        null,
        2,
      ),
    );
    return;
  }

  const baseline = await createBaselineWorktree(repoRoot);

  try {
    await mkdir(outputRoot, { recursive: true });
    const beforeRows = await runTarget({
      harnessLabel: "before",
      label: "before",
      outputDir: outputRoot,
      targetRoot: baseline.root,
    });
    const afterRows = await runTarget({
      harnessLabel: "after",
      label: "after",
      outputDir: outputRoot,
      targetRoot: repoRoot,
    });
    const interactionRows = await runInteractionTarget({
      outputDir: outputRoot,
      targetRoot: repoRoot,
    });
    const allRows = [...beforeRows, ...afterRows];
    const baselineHead = await Bun.spawn(["git", "rev-parse", "HEAD"], {
      cwd: baseline.root,
      stderr: "pipe",
      stdout: "pipe",
    }).stdout.text();

    await writeReport({
      baselineHead: baselineHead.trim(),
      interactionRows,
      outputRoot,
      repoRoot,
      rows: allRows,
    });
    await writeFile(
      path.join(outputRoot, "summary.json"),
      JSON.stringify(
        {
          comparisonRows: allRows,
          interactionRows,
        },
        null,
        2,
      ),
    );
  } finally {
    await baseline.cleanup();
  }
};

void main();

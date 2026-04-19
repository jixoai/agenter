// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { createAnchoredVirtualListScrollController } from "./anchored-virtual-list-scroll-controller";
import { createNamedScrollController } from "./named-scroll-controller";
import {
  createActionTrigger,
  createCollectionDeltaTrigger,
  createEdgeTrigger,
  createUserInputTrigger,
  defineScrollTriggerName,
  readScrollTriggerQuery,
} from "./named-scroll-triggers";
import type { AnchoredVirtualListHostAdapter } from "./anchored-virtual-list-scroll.types";
import type {
  ActionTriggerQuery,
  CollectionDeltaTriggerQuery,
  EdgeTriggerQuery,
  UserInputTriggerQuery,
} from "./named-scroll-trigger.types";

const createViewport = (): HTMLDivElement => {
  const viewport = document.createElement("div");
  let scrollTop = 0;
  Object.defineProperty(viewport, "scrollTop", {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = value;
    },
  });
  Object.defineProperty(viewport, "scrollLeft", {
    configurable: true,
    get: () => 0,
  });
  Object.defineProperty(viewport, "clientHeight", {
    configurable: true,
    get: () => 240,
  });
  Object.defineProperty(viewport, "scrollHeight", {
    configurable: true,
    get: () => 720,
  });
  Object.defineProperty(viewport, "scrollWidth", {
    configurable: true,
    get: () => 320,
  });
  Object.defineProperty(viewport, "clientWidth", {
    configurable: true,
    get: () => 320,
  });
  Object.defineProperty(viewport, "onscrollend", {
    configurable: true,
    writable: true,
    value: null,
  });
  viewport.scrollTo = (x?: number | ScrollToOptions, y?: number): void => {
    if (typeof x === "number") {
      scrollTop = x;
    } else {
      scrollTop = x?.top ?? scrollTop;
      if (typeof y === "number") {
        scrollTop = y;
      }
    }
    viewport.dispatchEvent(new Event("scroll"));
    viewport.dispatchEvent(new Event("scrollend"));
  };
  document.body.append(viewport);
  return viewport;
};

const createHostAdapter = (viewport: HTMLDivElement): AnchoredVirtualListHostAdapter => ({
  getViewport: () => viewport,
  getContentRoot: () => viewport,
  getEdgeState: () => ({
    atLatest: viewport.scrollTop === 0,
    atStart: viewport.scrollTop <= -480,
  }),
  readPosition: () => ({
    top: viewport.scrollTop,
    left: 0,
  }),
  resolveEdgePosition: (edge) => ({
    top: edge === "latest" ? 0 : -480,
    left: 0,
  }),
  resolveTarget: async (request) => {
    switch (request.target.kind) {
      case "edge":
        return request.target;
      case "position":
        return {
          kind: "position",
          top: request.target.top ?? 0,
          left: request.target.left ?? 0,
          reason: "requested",
        };
      case "element": {
        if (request.target.element) {
          return {
            ...request.target,
            element: request.target.element,
          };
        }
        if (!request.target.selector) {
          return null;
        }
        const element = viewport.querySelector(request.target.selector);
        return element
          ? {
              ...request.target,
              element,
            }
          : null;
      }
    }
  },
  scrollToEdge: (edge) => {
    viewport.scrollTop = edge === "latest" ? 0 : -480;
    viewport.dispatchEvent(new Event("scroll"));
    viewport.dispatchEvent(new Event("scrollend"));
  },
  scrollToPosition: (position) => {
    viewport.scrollTop = position.top;
    viewport.dispatchEvent(new Event("scroll"));
    viewport.dispatchEvent(new Event("scrollend"));
  },
  awaitDomSettle: async () => {
    await Promise.resolve();
  },
});

describe("Feature: named trigger query scroll controller", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => {
        callback(Date.now());
      }, 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
      window.clearTimeout(handle);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  test("Scenario: Given an invalid trigger key When defineScrollTriggerName runs Then registration is rejected", () => {
    expect(() => defineScrollTriggerName("bad-key")).toThrowError(/Invalid scroll trigger name/);
  });

  test("Scenario: Given two triggers claim the same name When the second binding connects Then the controller rejects the duplicate namespace", async () => {
    const viewport = createViewport();
    const kernel = createAnchoredVirtualListScrollController();
    const controller = createNamedScrollController({ kernel });
    controller.connect(createHostAdapter(viewport));
    const triggerName = defineScrollTriggerName<ActionTriggerQuery>("action");
    const buttonA = document.createElement("button");
    const buttonB = document.createElement("button");
    viewport.append(buttonA, buttonB);

    const disconnectA = createActionTrigger().observe({ element: buttonA }).connect(controller, {
      name: triggerName,
    });

    expect(() =>
      createActionTrigger().observe({ element: buttonB }).connect(controller, {
        name: triggerName,
      }),
    ).toThrowError(/already registered/);

    disconnectA();
  });

  test("Scenario: Given an action trigger fires When the controller flushes Then the program sees one-cycle fired semantics", async () => {
    const viewport = createViewport();
    const kernel = createAnchoredVirtualListScrollController();
    const controller = createNamedScrollController({ kernel });
    controller.connect(createHostAdapter(viewport));
    const actionName = defineScrollTriggerName<ActionTriggerQuery>("returnToLatest");
    const button = document.createElement("button");
    viewport.append(button);
    createActionTrigger().observe({ element: button }).connect(controller, { name: actionName });

    let seenFired = 0;
    controller.install((program) => {
      const action = readScrollTriggerQuery(program.query, actionName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      if (action.fired) {
        seenFired += 1;
      }
    });

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(seenFired).toBe(1);
    expect(
      readScrollTriggerQuery(controller.getQuery(), actionName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      }).fired,
    ).toBe(false);
  });

  test("Scenario: Given collection keys change through DOM mutation When the trigger flushes Then append and prepend directions are identified", async () => {
    const viewport = createViewport();
    const kernel = createAnchoredVirtualListScrollController();
    const controller = createNamedScrollController({ kernel });
    controller.connect(createHostAdapter(viewport));
    const deltaName = defineScrollTriggerName<CollectionDeltaTriggerQuery>("rowDelta");
    let keys = ["1", "2", "3"];
    for (const key of keys) {
      const row = document.createElement("div");
      row.dataset.key = key;
      viewport.append(row);
    }
    createCollectionDeltaTrigger({
      getKeys: () => keys,
    }).observe({ content: viewport }).connect(controller, { name: deltaName });

    let latestDelta = readScrollTriggerQuery(controller.getQuery(), deltaName, {
      changed: false,
      direction: "unknown",
      insertedKeys: [],
      removedKeys: [],
      anchorKey: null,
    });

    const unsubscribe = controller.subscribe((query) => {
      latestDelta = readScrollTriggerQuery(query, deltaName, latestDelta);
    });

    keys = ["1", "2", "3", "4"];
    const appendedRow = document.createElement("div");
    appendedRow.dataset.key = "4";
    viewport.append(appendedRow);
    await Promise.resolve();
    await Promise.resolve();
    expect(latestDelta.direction).toBe("append");
    expect(latestDelta.insertedKeys).toEqual(["4"]);

    keys = ["0", "1", "2", "3", "4"];
    const prependedRow = document.createElement("div");
    prependedRow.dataset.key = "0";
    viewport.prepend(prependedRow);
    await Promise.resolve();
    await Promise.resolve();
    expect(latestDelta.direction).toBe("prepend");
    expect(latestDelta.insertedKeys).toEqual(["0"]);

    unsubscribe();
  });

  test("Scenario: Given edge and action facts are both true When the program runs Then switch(true) honors the first matching branch only", async () => {
    const viewport = createViewport();
    const sentinel = document.createElement("div");
    sentinel.dataset.bottomAnchoredTimelineLatestSentinel = "true";
    viewport.prepend(sentinel);
    const kernel = createAnchoredVirtualListScrollController();
    const controller = createNamedScrollController({ kernel });
    controller.connect(createHostAdapter(viewport));
    const edgeName = defineScrollTriggerName<EdgeTriggerQuery>("edge");
    const actionName = defineScrollTriggerName<ActionTriggerQuery>("action");
    const button = document.createElement("button");
    viewport.append(button);

    createEdgeTrigger().observe({ viewport, content: viewport }).connect(controller, { name: edgeName });
    createActionTrigger().observe({ element: button }).connect(controller, { name: actionName });

    let actionBranchCount = 0;
    let edgeBranchCount = 0;
    controller.install((program) => {
      const action = readScrollTriggerQuery(program.query, actionName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      const edge = readScrollTriggerQuery(program.query, edgeName, {
        atLatest: false,
        atStart: false,
        enteredLatest: false,
        leftLatest: false,
        enteredStart: false,
        leftStart: false,
        distanceToLatestPx: 0,
        distanceToStartPx: 0,
      });
      switch (true) {
        case action.fired:
          actionBranchCount += 1;
          return;
        case edge.atLatest:
          edgeBranchCount += 1;
          return;
      }
    });

    button.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(actionBranchCount).toBe(1);
    expect(edgeBranchCount).toBeGreaterThanOrEqual(0);
  });

  test("Scenario: Given wheel input starts When the user-input trigger flushes Then the query exposes an active wheel session", async () => {
    const viewport = createViewport();
    const kernel = createAnchoredVirtualListScrollController();
    const controller = createNamedScrollController({ kernel });
    controller.connect(createHostAdapter(viewport));
    const userInputName = defineScrollTriggerName<UserInputTriggerQuery>("userInput");
    createUserInputTrigger().observe({ viewport }).connect(controller, { name: userInputName });

    let latestUserInput = readScrollTriggerQuery(controller.getQuery(), userInputName, {
      active: false,
      entered: false,
      exited: false,
      kind: "idle",
      pointerType: null,
      momentum: false,
      startedAt: null,
      lastEventAt: null,
    });
    const unsubscribe = controller.subscribe((query) => {
      latestUserInput = readScrollTriggerQuery(query, userInputName, latestUserInput);
    });

    viewport.dispatchEvent(new Event("wheel"));
    await Promise.resolve();
    await Promise.resolve();

    expect(latestUserInput.active).toBe(true);
    expect(latestUserInput.kind).toBe("wheel");
    expect(latestUserInput.entered).toBe(true);

    unsubscribe();
  });
});

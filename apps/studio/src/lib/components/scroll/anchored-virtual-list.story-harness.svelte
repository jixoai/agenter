<script lang="ts">
  import {
    AnchoredVirtualList,
    ScrollView,
    createActionTrigger,
    createCollectionDeltaTrigger,
    createEdgeTrigger,
    createInsertBatchTrigger,
    createOverflowTrigger,
    createUserInputTrigger,
    defineScrollTriggerName,
    getBottomAnchoredDistanceToLatest,
    getBottomAnchoredDistanceToStart,
    isAnchoredVirtualListAbortError,
    type ActionTriggerQuery,
    type AnchoredVirtualListResolvedTarget,
    type AnchoredVirtualListScrollHandle,
    type AnchoredVirtualListScrollStateSnapshot,
    type CollectionDeltaTriggerQuery,
    type EdgeTriggerQuery,
    type InsertBatchTriggerQuery,
    type OverflowTriggerQuery,
    readScrollTriggerQuery,
    type ScrollController,
    type ScrollProgramController,
    type ScrollViewVirtualizer,
    type UserInputTriggerQuery,
  } from "@agenter/svelte-components";
  import { onDestroy, tick } from "svelte";

  type DemoRowTone = "older" | "baseline" | "latest";
  type DemoRow = {
    id: number;
    title: string;
    body: string;
    collapsed: boolean;
    collapsedBody: string;
    estimateSize: number;
    tone: DemoRowTone;
  };

  type TransitionEntry = {
    phase: string;
    timestampMs: number;
    userInputKind: string;
  };

  const buildParagraph = (seed: number, tone: DemoRowTone): string => {
    const prefix =
      tone === "older"
        ? "Earlier transcript surface used for history materialization."
        : tone === "latest"
          ? "Latest-edge content intended to stay readable while pinned."
          : "Baseline transcript row used to test semantic scroll requests.";
    const fragments = [
      "Semantic targets stay expressed as edge / element / position.",
      "Virtualized hosts keep materialization inside the adapter boundary.",
      "Mouse wheel, touch drag, keyboard, and momentum need explicit arbitration.",
      "Eventual scroll position should be inspectable instead of hidden inside ad-hoc route state.",
    ];
    return `${prefix} ${fragments[seed % fragments.length]} ${fragments[(seed + 1) % fragments.length]}`;
  };

  const createRow = (id: number, tone: DemoRowTone, overrides: Partial<DemoRow> = {}): DemoRow => ({
    id,
    title: tone === "older" ? `History ${id}` : tone === "latest" ? `Latest ${id}` : `Message ${id}`,
    body: overrides.body ?? `${buildParagraph(id, tone)} ${buildParagraph(id + 2, tone)}`,
    collapsed: overrides.collapsed ?? false,
    collapsedBody: overrides.collapsedBody ?? "Collapsed preview keeps this row intentionally short.",
    estimateSize: overrides.estimateSize ?? 118 + Math.abs(id % 4) * 24,
    tone,
  });

  const createInitialRows = (): DemoRow[] =>
    Array.from({ length: 24 }, (_, index) => createRow(index + 1, index >= 18 ? "latest" : "baseline"));

  const initialRows = createInitialRows();
  const edgeTriggerName = defineScrollTriggerName<EdgeTriggerQuery>("edge");
  const userInputTriggerName = defineScrollTriggerName<UserInputTriggerQuery>("userInput");
  const seekLatestTriggerName = defineScrollTriggerName<ActionTriggerQuery>("seekLatest");
  const pinLatestTriggerName = defineScrollTriggerName<ActionTriggerQuery>("pinLatest");
  const seekStartTriggerName = defineScrollTriggerName<ActionTriggerQuery>("seekStart");
  const revealMiddleTriggerName = defineScrollTriggerName<ActionTriggerQuery>("revealMiddle");
  const rowDeltaTriggerName = defineScrollTriggerName<CollectionDeltaTriggerQuery>("rowDelta");
  const latestInsertTriggerName = defineScrollTriggerName<InsertBatchTriggerQuery>("latestInsert");
  const olderInsertTriggerName = defineScrollTriggerName<InsertBatchTriggerQuery>("olderInsert");
  const overflowTriggerName = defineScrollTriggerName<OverflowTriggerQuery>("overflow");
  const emptyEdgeQuery: EdgeTriggerQuery = {
    atLatest: true,
    atStart: true,
    enteredLatest: false,
    leftLatest: false,
    enteredStart: false,
    leftStart: false,
    distanceToLatestPx: 0,
    distanceToStartPx: 0,
  };
  const emptyUserInputQuery: UserInputTriggerQuery = {
    active: false,
    entered: false,
    exited: false,
    kind: "idle",
    pointerType: null,
    momentum: false,
    startedAt: null,
    lastEventAt: null,
  };
  const emptyDeltaQuery: CollectionDeltaTriggerQuery = {
    changed: false,
    direction: "unknown",
    insertedKeys: [],
    removedKeys: [],
    anchorKey: null,
  };
  const emptyInsertQuery = (motion: "latest" | "older"): InsertBatchTriggerQuery => ({
    changed: false,
    motion,
    elements: [],
    extentPx: 0,
    nearestElement: null,
  });
  const emptyOverflowQuery: OverflowTriggerQuery = {
    overflowing: false,
    becameOverflowing: false,
    becameContained: false,
    overflowPx: 0,
    visibleExtentPx: 0,
    contentExtentPx: 0,
  };

  let items = $state<DemoRow[]>(initialRows);
  let nextLatestId = $state((initialRows.at(-1)?.id ?? 0) + 1);
  let nextOlderId = $state(0);
  let viewportRef = $state<HTMLDivElement | null>(null);
  let contentRef = $state<HTMLDivElement | null>(null);
  let virtualizerRef = $state<ScrollViewVirtualizer | null>(null);
  let scrollHandleRef = $state<AnchoredVirtualListScrollHandle | null>(null);
  let scrollControllerRef = $state<ScrollController | null>(null);
  let scrollState = $state<AnchoredVirtualListScrollStateSnapshot | undefined>(undefined);
  let scrollQuery = $state<Record<string, unknown>>({});
  let activeTx = $state<Record<string, unknown> | null>(null);
  let seekLatestButtonRef = $state<HTMLButtonElement | null>(null);
  let pinLatestButtonRef = $state<HTMLButtonElement | null>(null);
  let seekStartButtonRef = $state<HTMLButtonElement | null>(null);
  let revealMiddleButtonRef = $state<HTMLButtonElement | null>(null);
  let atLatest = $state(true);
  let atStart = $state(false);
  let lastMutation = $state<{
    mutation: "append" | "appendPreserveAway" | "collapse" | "prepend" | "resize" | "reset" | null;
    terminalState: string | null;
  }>({ mutation: null, terminalState: null });
  let lastCommand = $state<{
    command: "pinLatest" | "reset" | "revealMiddle" | "seekLatest" | "seekStart" | null;
    terminalState: string | null;
  }>({ command: null, terminalState: null });
  let transitionLog = $state<TransitionEntry[]>([]);

  let transitionLogStore: TransitionEntry[] = [];
  let installedTriggerCleanup: (() => void) | null = null;
  let installedTriggerSignature:
    | {
        controller: ScrollController | null;
        viewport: HTMLDivElement | null;
        content: HTMLDivElement | null;
        seekLatestButton: HTMLButtonElement | null;
        pinLatestButton: HTMLButtonElement | null;
        seekStartButton: HTMLButtonElement | null;
        revealMiddleButton: HTMLButtonElement | null;
      }
    | null = null;

  const middleSelector = $derived.by(() => {
    const middle = items[Math.floor(items.length / 2)];
    return middle ? `[data-demo-row-id="${middle.id}"]` : null;
  });

  const getRowKeys = (): readonly string[] => items.map((item) => String(item.id));

  const getCurrentMiddleSelector = (): string | null => middleSelector;

  const serializeTarget = (
    target: AnchoredVirtualListResolvedTarget | AnchoredVirtualListScrollStateSnapshot["eventualScrollPosition"]["target"] | null,
  ): Record<string, unknown> | null => {
    if (!target) {
      return null;
    }
    switch (target.kind) {
      case "edge":
        return { kind: target.kind, edge: target.edge };
      case "position":
        return { kind: target.kind, top: target.top ?? null, left: target.left ?? null };
      case "element": {
        const element = "element" in target ? target.element : null;
        return {
          kind: target.kind,
          rowId: element instanceof HTMLElement ? Number(element.dataset.demoRowId ?? Number.NaN) || null : null,
          selector: "selector" in target ? (target.selector ?? null) : null,
        };
      }
    }
  };

  const readVisibleRows = (): {
    center: number | null;
    first: number | null;
    last: number | null;
    trailing: number | null;
  } => {
    const virtualItems = virtualizerRef?.getVirtualItems() ?? [];
    const trailingVisibleRowId =
      virtualItems.length > 0
        ? (() => {
            const nextId = Math.max(
              ...virtualItems.map(
                (virtualItem) => items[items.length - virtualItem.index - 1]?.id ?? Number.NEGATIVE_INFINITY,
              ),
            );
            return Number.isFinite(nextId) ? nextId : null;
          })()
        : null;

    const viewport = viewportRef;
    if (!(viewport instanceof HTMLElement)) {
      return { center: null, first: null, last: null, trailing: trailingVisibleRowId };
    }
    const viewportRect = viewport.getBoundingClientRect();
    const rows = Array.from(viewport.querySelectorAll<HTMLElement>("[data-demo-row-id]")).filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom >= viewportRect.top && rect.top <= viewportRect.bottom;
    });
    if (rows.length === 0) {
      return { center: null, first: null, last: null, trailing: trailingVisibleRowId };
    }
    const viewportCenter = viewportRect.top + viewportRect.height / 2;
    let centerRow: HTMLElement | null = null;
    let centerDistance = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const rect = row.getBoundingClientRect();
      const rowCenter = rect.top + rect.height / 2;
      const distance = Math.abs(rowCenter - viewportCenter);
      if (distance < centerDistance) {
        centerDistance = distance;
        centerRow = row;
      }
    }
    const readRowId = (element: HTMLElement | undefined | null): number | null => {
      const raw = element?.dataset.demoRowId;
      if (raw === undefined) {
        return null;
      }
      const parsed = Number(raw);
      return Number.isNaN(parsed) ? null : parsed;
    };
    return {
      center: readRowId(centerRow),
      first: readRowId(rows[0]),
      last: readRowId(rows.at(-1)),
      trailing:
        trailingVisibleRowId ??
        Math.max(...rows.map((row) => readRowId(row) ?? Number.NEGATIVE_INFINITY)),
    };
  };

  const stateJson = $derived.by(() =>
    JSON.stringify(
      {
        phase: scrollState?.phase ?? null,
        edge: scrollState?.edge ?? null,
        userInput: scrollState?.userInput ?? null,
        registeredTriggers: Object.keys(scrollQuery),
        triggerQuery: scrollQuery,
        activeTx,
        currentScrollTarget: serializeTarget(scrollState?.currentScrollTarget ?? null),
        eventualScrollPosition: serializeTarget(scrollState?.eventualScrollPosition.target ?? null),
        pendingTransaction: scrollState?.pendingTransaction ?? null,
        atLatest,
        atStart,
        itemCount: items.length,
        distanceToLatest: viewportRef ? getBottomAnchoredDistanceToLatest(viewportRef) : null,
        distanceToStart: viewportRef ? getBottomAnchoredDistanceToStart(viewportRef) : null,
        visibleRows: readVisibleRows(),
        lastMutation,
        lastCommand,
      },
      null,
      2,
    ),
  );

  const waitForHarnessSettle = async (): Promise<void> => {
    await tick();
    if (scrollHandleRef) {
      await scrollHandleRef.awaitSettle();
    }
    if (typeof requestAnimationFrame === "function") {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  };

  const finalizeTrackedResult = async (
    kind: "mutation" | "command",
    label: Exclude<typeof lastMutation.mutation, null> | Exclude<typeof lastCommand.command, null>,
    runner: () => Promise<void>,
  ): Promise<void> => {
    try {
      await runner();
      if (kind === "mutation") {
        await applyMutationResult(label as Exclude<typeof lastMutation.mutation, null>, "completed");
      } else {
        await applyCommandResult(label as Exclude<typeof lastCommand.command, null>, "completed");
      }
    } catch (error) {
      if (isAnchoredVirtualListAbortError(error)) {
        if (kind === "mutation") {
          await applyMutationResult(label as Exclude<typeof lastMutation.mutation, null>, error.reason);
        } else {
          await applyCommandResult(label as Exclude<typeof lastCommand.command, null>, error.reason);
        }
        return;
      }
      if (kind === "mutation") {
        await applyMutationResult(label as Exclude<typeof lastMutation.mutation, null>, "failed");
      } else {
        await applyCommandResult(label as Exclude<typeof lastCommand.command, null>, "failed");
      }
      throw error;
    }
  };

  const runProgramTx = async (
    program: ScrollProgramController,
    kind: "mutation" | "command",
    label: Exclude<typeof lastMutation.mutation, null> | Exclude<typeof lastCommand.command, null>,
    effect: Parameters<ScrollProgramController["tx"]>[0],
    options: Parameters<ScrollProgramController["tx"]>[1],
  ): Promise<void> => {
    const transaction = await program.tx(effect, options);
    activeTx = scrollControllerRef?.getActiveTx()
      ? { ...scrollControllerRef.getActiveTx()! }
      : null;
    await finalizeTrackedResult(kind, label, async () => {
      await transaction.finished;
    });
    activeTx = scrollControllerRef?.getActiveTx()
      ? { ...scrollControllerRef.getActiveTx()! }
      : null;
  };

  const focusViewport = (): void => {
    if (!viewportRef) {
      return;
    }
    viewportRef.tabIndex = 0;
    viewportRef.focus();
  };

  const applyMutationResult = async (
    mutation: Exclude<typeof lastMutation.mutation, null>,
    terminalState: string | null,
  ): Promise<void> => {
    lastMutation = {
      mutation,
      terminalState,
    };
    await waitForHarnessSettle();
  };

  const applyCommandResult = async (
    command: Exclude<typeof lastCommand.command, null>,
    terminalState: string | null,
  ): Promise<void> => {
    lastCommand = {
      command,
      terminalState,
    };
    await waitForHarnessSettle();
  };

  const applyRequestResult = async (
    command: Exclude<typeof lastCommand.command, null>,
    request:
      | Promise<import("@agenter/svelte-components").AnchoredVirtualListScrollTransactionResult>
      | null
      | undefined,
  ): Promise<void> => {
    if (!request) {
      await applyCommandResult(command, null);
      return;
    }
    try {
      const result = await request;
      await applyCommandResult(command, result.terminalState);
    } catch (error) {
      if (isAnchoredVirtualListAbortError(error)) {
        await applyCommandResult(command, error.reason);
        return;
      }
      await applyCommandResult(command, "failed");
      throw error;
    }
  };

  const restoreBaseFixture = async (mutation: typeof lastMutation.mutation = "reset"): Promise<void> => {
    items = createInitialRows();
    nextLatestId = (items.at(-1)?.id ?? 0) + 1;
    nextOlderId = 0;
    lastMutation = { mutation, terminalState: null };
    lastCommand = { command: null, terminalState: null };
    transitionLogStore = [];
    transitionLog = [];
    await waitForHarnessSettle();
  };

  const appendLatest = async (): Promise<void> => {
    const appendedId = nextLatestId;
    lastMutation = { mutation: "append", terminalState: null };
    items = [...items, createRow(appendedId, "latest", { estimateSize: 178 })];
    nextLatestId += 1;
  };

  const prependOlder = async (): Promise<void> => {
    const prependedRows = [
      createRow(nextOlderId - 1, "older", { estimateSize: 150 }),
      createRow(nextOlderId, "older", { estimateSize: 164 }),
    ];
    lastMutation = { mutation: "prepend", terminalState: null };
    items = [...prependedRows, ...items];
    nextOlderId -= 2;
  };

  const growLatest = async (): Promise<void> => {
    if (items.length === 0) {
      return;
    }
    const latest = items.at(-1)!;
    items = [
      ...items.slice(0, -1),
      {
        ...latest,
        body: `${latest.body} Added growth content to simulate resize / collapse reconciliation on the newest row.`,
        estimateSize: latest.estimateSize + 84,
      },
    ];
    await tick();
    const transaction = await scrollHandleRef?.notifyMutation({
      kind: "resize",
      debugLabel: "storybook-grow-latest",
    });
    await applyMutationResult("resize", transaction?.terminalState ?? null);
  };

  const collapseLatest = async (): Promise<void> => {
    if (items.length === 0) {
      return;
    }
    const latest = items.at(-1)!;
    items = [
      ...items.slice(0, -1),
      {
        ...latest,
        collapsed: !latest.collapsed,
        estimateSize: latest.collapsed ? latest.estimateSize + 112 : Math.max(78, latest.estimateSize - 112),
      },
    ];
    await tick();
    const transaction = await scrollHandleRef?.notifyMutation({
      kind: "collapse",
      debugLabel: "storybook-collapse-latest",
    });
    await applyMutationResult("collapse", transaction?.terminalState ?? null);
  };

  const seekLatest = async (): Promise<void> => {
    lastCommand = { command: "seekLatest", terminalState: null };
  };

  const pinLatest = async (): Promise<void> => {
    lastCommand = { command: "pinLatest", terminalState: null };
  };

  const seekStart = async (): Promise<void> => {
    lastCommand = { command: "seekStart", terminalState: null };
  };

  const revealMiddle = async (): Promise<void> => {
    lastCommand = { command: "revealMiddle", terminalState: null };
  };

  const reset = async (): Promise<void> => {
    await restoreBaseFixture();
    await applyRequestResult("reset", scrollHandleRef?.request({
      intent: "seek",
      target: { kind: "edge", edge: "latest" },
      behavior: "auto",
      debugLabel: "storybook-reset-latest",
    }));
  };

  const interruptWithWheel = (): void => {
    const viewport = viewportRef;
    if (!viewport) {
      return;
    }
    viewport.dispatchEvent(new Event("wheel"));
  };

  const interruptWithKeyboard = (): void => {
    const viewport = viewportRef;
    if (!viewport) {
      return;
    }
    viewport.focus();
    viewport.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "PageDown",
        code: "PageDown",
        bubbles: true,
      }),
    );
  };

  const interruptWithTouch = (): void => {
    const viewport = viewportRef;
    if (!viewport) {
      return;
    }
    viewport.dispatchEvent(new Event("touchstart", { bubbles: true }));
  };

  $effect(() => {
    if (!viewportRef) {
      return;
    }
    viewportRef.tabIndex = 0;
    viewportRef.setAttribute("aria-label", "Anchored virtual list story viewport");
  });

  const installNamedScrollProgram = (input: {
    controller: ScrollController;
    viewport: HTMLDivElement;
    content: HTMLDivElement | null;
    seekLatestButton: HTMLButtonElement;
    pinLatestButton: HTMLButtonElement;
    seekStartButton: HTMLButtonElement;
    revealMiddleButton: HTMLButtonElement;
  }): (() => void) => {
    const { controller, viewport, content, seekLatestButton, pinLatestButton, seekStartButton, revealMiddleButton } = input;
    const observedDom = {
      viewport,
      content: content ?? viewport,
    } satisfies Parameters<ReturnType<typeof createEdgeTrigger>["observe"]>[0];
    const disconnectEdge = createEdgeTrigger({
      latestThreshold: 48,
      startThreshold: 72,
    }).observe(observedDom).connect(controller, { name: edgeTriggerName });
    const disconnectUserInput = createUserInputTrigger().observe(observedDom).connect(controller, {
      name: userInputTriggerName,
    });
    const disconnectSeekLatest = createActionTrigger().observe({ element: seekLatestButton }).connect(controller, {
      name: seekLatestTriggerName,
    });
    const disconnectPinLatest = createActionTrigger().observe({ element: pinLatestButton }).connect(controller, {
      name: pinLatestTriggerName,
    });
    const disconnectSeekStart = createActionTrigger().observe({ element: seekStartButton }).connect(controller, {
      name: seekStartTriggerName,
    });
    const disconnectRevealMiddle = createActionTrigger()
      .observe({ element: revealMiddleButton })
      .connect(controller, { name: revealMiddleTriggerName });
    const disconnectRowDelta = createCollectionDeltaTrigger({
      getKeys: getRowKeys,
    }).observe(observedDom).connect(controller, { name: rowDeltaTriggerName });
    const disconnectLatestInsert = createInsertBatchTrigger({ motion: "latest" })
      .observe(observedDom)
      .connect(controller, { name: latestInsertTriggerName });
    const disconnectOlderInsert = createInsertBatchTrigger({ motion: "older" })
      .observe(observedDom)
      .connect(controller, { name: olderInsertTriggerName });
    const disconnectOverflow = createOverflowTrigger().observe(observedDom).connect(controller, {
      name: overflowTriggerName,
    });
    let previousEdgeAtLatest = true;
    let previousEdgeAtStart = false;

    const uninstallProgram = controller.install((program) => {
      const edge = readScrollTriggerQuery(program.query, edgeTriggerName, emptyEdgeQuery);
      const userInput = readScrollTriggerQuery(program.query, userInputTriggerName, emptyUserInputQuery);
      const rowDelta = readScrollTriggerQuery(program.query, rowDeltaTriggerName, emptyDeltaQuery);
      const seekLatestAction = readScrollTriggerQuery(program.query, seekLatestTriggerName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      const pinLatestAction = readScrollTriggerQuery(program.query, pinLatestTriggerName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      const seekStartAction = readScrollTriggerQuery(program.query, seekStartTriggerName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      const revealMiddleAction = readScrollTriggerQuery(program.query, revealMiddleTriggerName, {
        fired: false,
        count: 0,
        sourceElement: null,
        lastFiredAt: null,
      });
      const latestInsert = readScrollTriggerQuery(program.query, latestInsertTriggerName, emptyInsertQuery("latest"));
      const olderInsert = readScrollTriggerQuery(program.query, olderInsertTriggerName, emptyInsertQuery("older"));
      const overflow = readScrollTriggerQuery(program.query, overflowTriggerName, emptyOverflowQuery);
      const currentMiddleSelector = getCurrentMiddleSelector();
      const wasAtLatest = edge.atLatest || edge.leftLatest || previousEdgeAtLatest;
      const wasAtStart = edge.atStart || edge.leftStart || previousEdgeAtStart;
      const appendedRowAnchors = rowDelta.insertedKeys.map((rowId) => ({
        selector: `[data-demo-row-id="${rowId}"]`,
      }));
      previousEdgeAtLatest = edge.atLatest;
      previousEdgeAtStart = edge.atStart;

      switch (true) {
        case seekLatestAction.fired:
          return runProgramTx(
            program,
            "command",
            "seekLatest",
            async (tx) => {
              await tx.scroll.pinLatest({
                behavior: "smooth",
                debugLabel: "storybook-seek-latest",
              });
            },
            { priority: "user-blocking", debugLabel: "storybook-seek-latest" },
          );
        case pinLatestAction.fired:
          return runProgramTx(
            program,
            "command",
            "pinLatest",
            async (tx) => {
              await tx.scroll.pinLatest({
                behavior: "smooth",
                debugLabel: "storybook-pin-latest",
              });
            },
            { priority: "user-blocking", debugLabel: "storybook-pin-latest" },
          );
        case seekStartAction.fired:
          return runProgramTx(
            program,
            "command",
            "seekStart",
            async (tx) => {
              await tx.scroll.seekStart({
                behavior: "smooth",
                debugLabel: "storybook-seek-start",
              });
            },
            { priority: "user-blocking", debugLabel: "storybook-seek-start" },
          );
        case revealMiddleAction.fired && Boolean(currentMiddleSelector):
          return runProgramTx(
            program,
            "command",
            "revealMiddle",
            async (tx) => {
              await tx.scroll.revealElement(
                {
                  selector: currentMiddleSelector ?? undefined,
                  block: "nearest",
                  inline: "nearest",
                },
                {
                  behavior: "smooth",
                  ifNeeded: true,
                  debugLabel: "storybook-reveal-middle",
                },
              );
            },
            { priority: "user-blocking", debugLabel: "storybook-reveal-middle" },
          );
        case rowDelta.changed && rowDelta.direction === "append" && wasAtLatest && !userInput.active:
          return runProgramTx(
            program,
            "mutation",
            "append",
            async (tx) => {
              await tx.scroll.pinLatest({
                behavior: "smooth",
                debugLabel: "storybook-append-follow-latest",
              });
            },
            { priority: "background", debugLabel: "storybook-append-follow-latest" },
          );
        case rowDelta.changed && rowDelta.direction === "append" && !wasAtLatest && appendedRowAnchors.length > 0:
          return runProgramTx(
            program,
            "mutation",
            "appendPreserveAway",
            async (tx) => {
              tx.mutation.append({
                inserted: appendedRowAnchors,
              });
              tx.anchor.preserve();
              await tx.commit();
            },
            {
              priority: "background",
              interruptionPolicy: "protected",
              debugLabel: "storybook-append-preserve-away",
            },
          );
        case rowDelta.changed && rowDelta.direction === "prepend" && wasAtStart && !userInput.active: {
          const nearestOlderId = rowDelta.insertedKeys.at(-1) ?? rowDelta.anchorKey ?? null;
          if (!nearestOlderId) {
            return;
          }
          return runProgramTx(
            program,
            "mutation",
            "prepend",
            async (tx) => {
              await tx.scroll.revealElement(
                {
                  selector: `[data-demo-row-id="${nearestOlderId}"]`,
                  block: "nearest",
                  inline: "nearest",
                },
                {
                  behavior: "smooth",
                  ifNeeded: true,
                  debugLabel: "storybook-prepend-reveal-nearest-older",
                },
              );
            },
            { priority: "background", debugLabel: "storybook-prepend-reveal-nearest-older" },
          );
        }
        case overflow.becameOverflowing || overflow.becameContained:
        case userInput.entered:
          return;
      }
    });

    return () => {
      disconnectEdge();
      disconnectUserInput();
      disconnectSeekLatest();
      disconnectPinLatest();
      disconnectSeekStart();
      disconnectRevealMiddle();
      disconnectRowDelta();
      disconnectLatestInsert();
      disconnectOlderInsert();
      disconnectOverflow();
      uninstallProgram();
    };
  };

  onDestroy(() => {
    installedTriggerCleanup?.();
    installedTriggerCleanup = null;
    installedTriggerSignature = null;
  });

  $effect(() => {
    const controller = scrollControllerRef;
    const viewport = viewportRef;
    const content = contentRef;
    const seekLatestButton = seekLatestButtonRef;
    const pinLatestButton = pinLatestButtonRef;
    const seekStartButton = seekStartButtonRef;
    const revealMiddleButton = revealMiddleButtonRef;
    const nextSignature = {
      controller,
      viewport,
      content,
      seekLatestButton,
      pinLatestButton,
      seekStartButton,
      revealMiddleButton,
    };
    const signatureUnchanged =
      installedTriggerSignature?.controller === nextSignature.controller &&
      installedTriggerSignature?.viewport === nextSignature.viewport &&
      installedTriggerSignature?.content === nextSignature.content &&
      installedTriggerSignature?.seekLatestButton === nextSignature.seekLatestButton &&
      installedTriggerSignature?.pinLatestButton === nextSignature.pinLatestButton &&
      installedTriggerSignature?.seekStartButton === nextSignature.seekStartButton &&
      installedTriggerSignature?.revealMiddleButton === nextSignature.revealMiddleButton;
    if (signatureUnchanged) {
      return;
    }
    installedTriggerCleanup?.();
    installedTriggerCleanup = null;
    installedTriggerSignature = nextSignature;
    if (!controller || !viewport || !seekLatestButton || !pinLatestButton || !seekStartButton || !revealMiddleButton) {
      return;
    }
    installedTriggerCleanup = installNamedScrollProgram({
      controller,
      viewport,
      content,
      seekLatestButton,
      pinLatestButton,
      seekStartButton,
      revealMiddleButton,
    });
  });

  $effect(() => {
    scrollHandleRef;
    transitionLogStore = [];
    transitionLog = [];
    const unsubscribe = scrollHandleRef?.subscribe((snapshot) => {
      const nextEntry: TransitionEntry = {
        phase: snapshot.phase,
        timestampMs: typeof performance !== "undefined" ? performance.now() : Date.now(),
        userInputKind: snapshot.userInput.kind,
      };
      const previous = transitionLogStore.at(-1);
      if (
        previous?.phase === nextEntry.phase &&
        previous.userInputKind === nextEntry.userInputKind
      ) {
        return;
      }
      transitionLogStore = [...transitionLogStore.slice(-11), nextEntry];
      transitionLog = transitionLogStore;
    });
    return () => {
      unsubscribe?.();
    };
  });

  $effect(() => {
    const unsubscribe = scrollControllerRef?.subscribe((query) => {
      scrollQuery = query;
      activeTx = scrollControllerRef?.getActiveTx() ? { ...scrollControllerRef.getActiveTx()! } : null;
    });
    return () => {
      unsubscribe?.();
    };
  });
</script>

<div
  class="avl-story-shell grid h-[calc(100svh-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-4"
  data-testid="anchored-virtual-list-story"
>
  <section
    class="grid gap-3 rounded-[1.35rem] border border-border/70 bg-background/90 p-4 shadow-sm"
    data-testid="anchored-virtual-list-controls"
  >
    <div class="flex flex-wrap gap-2">
      <button class="rounded-full border px-3 py-1.5 text-sm" data-testid="avl-append-latest" onclick={appendLatest}>
        Append latest
      </button>
      <button class="rounded-full border px-3 py-1.5 text-sm" data-testid="avl-prepend-older" onclick={prependOlder}>
        Prepend older
      </button>
      <button class="rounded-full border px-3 py-1.5 text-sm" data-testid="avl-grow-latest" onclick={growLatest}>
        Resize latest
      </button>
      <button
        class="rounded-full border px-3 py-1.5 text-sm"
        data-testid="avl-collapse-latest"
        onclick={collapseLatest}
      >
        Collapse latest
      </button>
      <button
        bind:this={seekLatestButtonRef}
        class="rounded-full border px-3 py-1.5 text-sm"
        data-testid="avl-seek-latest"
        onclick={seekLatest}
      >
        Seek latest
      </button>
      <button
        bind:this={seekStartButtonRef}
        class="rounded-full border px-3 py-1.5 text-sm"
        data-testid="avl-seek-start"
        onclick={seekStart}
      >
        Seek start
      </button>
      <button
        bind:this={pinLatestButtonRef}
        class="rounded-full border px-3 py-1.5 text-sm"
        data-testid="avl-pin-latest"
        onclick={pinLatest}
      >
        Pin latest
      </button>
      <button
        bind:this={revealMiddleButtonRef}
        class="rounded-full border px-3 py-1.5 text-sm"
        data-testid="avl-reveal-middle"
        onclick={revealMiddle}
      >
        Reveal middle
      </button>
      <button class="rounded-full border px-3 py-1.5 text-sm" data-testid="avl-focus-viewport" onclick={focusViewport}>
        Focus viewport
      </button>
      <button class="rounded-full border px-3 py-1.5 text-sm" data-testid="avl-interrupt-wheel" onclick={interruptWithWheel}>
        Interrupt wheel
      </button>
      <button
        class="rounded-full border px-3 py-1.5 text-sm"
        data-testid="avl-interrupt-keyboard"
        onclick={interruptWithKeyboard}
      >
        Interrupt key
      </button>
      <button class="rounded-full border px-3 py-1.5 text-sm" data-testid="avl-interrupt-touch" onclick={interruptWithTouch}>
        Interrupt touch
      </button>
      <button class="rounded-full border px-3 py-1.5 text-sm" data-testid="avl-reset" onclick={reset}>
        Reset
      </button>
    </div>

    <details class="rounded-[1rem] border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
      <summary class="cursor-pointer list-none font-medium text-foreground">
        Demo notes and manual verification steps
      </summary>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <div class="space-y-2">
          <p>
            Use this as the acceptance surface for the shared scroll law: transaction-closure append/prepend,
            resize, and collapse while watching phase, targets, and visible anchor rows.
          </p>
          <p><strong class="text-foreground">Near latest auto-follow:</strong> click <code>Append latest</code> while already near the latest edge.</p>
          <p><strong class="text-foreground">Near start auto-reveal:</strong> click <code>Seek start</code>, then <code>Prepend older</code>.</p>
          <p><strong class="text-foreground">Latest growth:</strong> click <code>Seek latest</code>, then <code>Resize latest</code>.</p>
        </div>
        <div class="space-y-2">
          <p><strong class="text-foreground">Collapsed latest:</strong> click <code>Seek latest</code>, then <code>Collapse latest</code>.</p>
          <p><strong class="text-foreground">Interruptions:</strong> use <code>Interrupt wheel</code>, <code>Interrupt key</code>, or <code>Interrupt touch</code> while a smooth request is running.</p>
          <p><strong class="text-foreground">Desktop input:</strong> click <code>Focus viewport</code>, then use wheel and <code>PageUp/PageDown</code>.</p>
          <p><strong class="text-foreground">Mobile input:</strong> switch Storybook to a mobile viewport and drag inside the list.</p>
          <p>The center pane below is the intended scroll owner. The surrounding Storybook canvas should no longer be the primary scroll surface.</p>
        </div>
      </div>
    </details>
  </section>

  <div class="avl-story-body grid h-full gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
    <section class="avl-story-panel grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-[1.6rem] border border-border/70 bg-background/95 p-3 shadow-sm">
      <div class="flex items-center justify-between gap-3 px-1 pb-3">
        <div>
          <h3 class="text-sm font-medium">Transcript viewport</h3>
          <p class="text-xs text-muted-foreground">This pane should own vertical scrolling.</p>
        </div>
        <span class="rounded-full border border-border/60 bg-muted/25 px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Internal scroll
        </span>
      </div>
      <div class="avl-story-viewport-shell">
        <AnchoredVirtualList
          class="h-full"
          viewportClass="anchored-story-viewport rounded-[1.2rem] border border-border/60 bg-muted/15 p-4"
          contentClass="gap-3"
          viewportTestId="anchored-virtual-list-viewport"
          bind:viewportRef
          bind:contentRef
          bind:scrollHandleRef
          bind:scrollControllerRef
          bind:scrollState
          bind:atLatest
          bind:atStart
          {items}
          virtual={{
            estimateSize: (_index, row) => row.estimateSize,
            getItemKey: (_index, row) => row.id,
            measureElement: true,
            overscan: 6,
            useAnimationFrameWithResizeObserver: true,
          }}
          bind:virtualizerRef
        >
          {#snippet start()}
            <div class="pb-2 text-center text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Visual top / history start
            </div>
          {/snippet}

          {#snippet item(row, index)}
            <article
              class={`rounded-[1.15rem] border px-4 py-3 shadow-sm transition-colors ${
                row.tone === "older"
                  ? "border-amber-300/40 bg-amber-50/70"
                  : row.tone === "latest"
                    ? "border-emerald-300/45 bg-emerald-50/70"
                    : "border-border/70 bg-background"
              }`}
              data-demo-row-id={row.id}
              data-testid={`anchored-virtual-list-row-${row.id}`}
            >
              <div class="flex items-center justify-between gap-3">
                <strong class="text-sm font-medium">{row.title}</strong>
                <span class="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  row {index} · {row.collapsed ? "collapsed" : "expanded"}
                </span>
              </div>
              <p class="mt-2 text-sm leading-6 text-foreground/85">{row.collapsed ? row.collapsedBody : row.body}</p>
            </article>
          {/snippet}

          {#snippet end()}
            <div class="pt-2 text-center text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Visual bottom / latest edge
            </div>
          {/snippet}
        </AnchoredVirtualList>
      </div>
    </section>

    <aside class="avl-story-sidebar grid h-full gap-4">
      <section class="avl-story-panel grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-[1.6rem] border border-border/70 bg-background/95 p-4 shadow-sm">
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Coordinator state</h3>
          <p class="text-xs text-muted-foreground">
            Inspect semantic state instead of route-local <code>scrollTop</code> bookkeeping.
          </p>
        </div>
        <ScrollView class="mt-4 h-full" contentClass="rounded-[1rem] border border-border/60 bg-muted/20 p-3">
          <pre class="text-[11px] leading-5" data-testid="anchored-virtual-list-state">{stateJson}</pre>
        </ScrollView>
      </section>

      <section class="avl-story-panel grid h-full grid-rows-[auto_minmax(0,1fr)] rounded-[1.6rem] border border-border/70 bg-background/95 p-4 shadow-sm">
        <div class="space-y-2">
          <h3 class="text-sm font-medium">Observed transitions</h3>
          <p class="text-xs text-muted-foreground">
            Watch <code>userInput.kind</code> transition through wheel, keyboard, direct-manipulation, and momentum.
          </p>
        </div>
        <ScrollView class="mt-4 h-full">
          <ul class="space-y-2 text-xs text-foreground/85" data-testid="anchored-virtual-list-transitions">
            {#each transitionLog as entry}
              <li class="rounded-[0.9rem] border border-border/60 bg-muted/15 px-3 py-2">
                <span class="font-medium">{entry.userInputKind}</span>
                <span class="text-muted-foreground"> / {entry.phase}</span>
                <span class="float-right text-muted-foreground">{Math.round(entry.timestampMs)}ms</span>
              </li>
            {/each}
          </ul>
        </ScrollView>
      </section>
    </aside>
  </div>
</div>

<style>
  .avl-story-shell,
  .avl-story-body,
  .avl-story-sidebar,
  .avl-story-panel,
  .avl-story-viewport-shell {
    min-block-size: 0;
  }

  .avl-story-viewport-shell {
    block-size: 100%;
  }

  :global(.anchored-story-viewport) {
    scrollbar-gutter: stable both-edges;
  }
</style>

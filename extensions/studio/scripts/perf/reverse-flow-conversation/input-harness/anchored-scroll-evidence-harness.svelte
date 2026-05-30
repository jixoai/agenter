<script lang="ts">
  import {
    AnchoredVirtualList,
    getBottomAnchoredDistanceToLatest,
    getBottomAnchoredDistanceToStart,
    type AnchoredVirtualListResolvedTarget,
    type AnchoredVirtualListScrollHandle,
    type AnchoredVirtualListScrollStateSnapshot,
    type AnchoredVirtualListScrollTransactionResult,
  } from "@agenter/svelte-components";
  import { tick } from "svelte";

  import {
    appendAnchoredLatestRow,
    collapseAnchoredLatestRow,
    createAnchoredEvidenceRows,
    prependAnchoredOlderRows,
    resizeAnchoredLatestRow,
    type AnchoredEvidenceRow,
  } from "./anchored-scroll-fixtures";
  import { waitForAnimationFrames } from "./viewport-helpers";

  type VisibleRowsSnapshot = {
    center: number | null;
    first: number | null;
    last: number | null;
  };

  type SerializedTarget =
    | { kind: "edge"; edge: "latest" | "start" }
    | { kind: "element"; selector: string | null; rowId: number | null }
    | { kind: "position"; top: number | null; left: number | null }
    | null;

  export type AnchoredEvidenceSnapshot = {
    atLatest: boolean;
    atStart: boolean;
    currentScrollTarget: SerializedTarget;
    distanceToLatest: number;
    distanceToStart: number;
    eventualScrollPosition: SerializedTarget;
    itemCount: number;
    lastTerminalState: string | null;
    phase: string;
    scrollHeight: number;
    scrollTop: number;
    userInputActive: boolean;
    userInputKind: string;
    visibleRows: VisibleRowsSnapshot;
  };

  type TransitionEntry = {
    phase: string;
    timestampMs: number;
    userInputKind: string;
  };

  type MutationEvidence = {
    mutation: "append" | "collapse" | "prepend" | "resize";
    snapshot: AnchoredEvidenceSnapshot;
    transactionTerminalState: string | null;
  };

  declare global {
    interface Window {
      __reverseFlowPerf?: {
        appendAnchoredEvidence?: () => Promise<MutationEvidence>;
        collapseAnchoredEvidence?: () => Promise<MutationEvidence>;
      focusAnchoredEvidenceViewport?: () => void;
        getAnchoredEvidenceLog?: () => TransitionEntry[];
        getAnchoredEvidenceSnapshot?: () => AnchoredEvidenceSnapshot | null;
        prependAnchoredEvidence?: () => Promise<MutationEvidence>;
        revealAnchoredEvidenceMiddle?: () => Promise<void>;
        seekAnchoredEvidenceStart?: () => Promise<void>;
        resetAnchoredEvidence?: () => Promise<void>;
        resizeAnchoredEvidence?: () => Promise<MutationEvidence>;
      };
    }
  }

  const createInitialItems = (): AnchoredEvidenceRow[] => createAnchoredEvidenceRows();
  const initialItems = createInitialItems();

  let items = $state<AnchoredEvidenceRow[]>(initialItems);
  let nextLatestId = $state((initialItems.at(-1)?.id ?? 0) + 1);
  let nextOlderId = $state(0);
  let viewportRef = $state<HTMLDivElement | null>(null);
  let scrollHandleRef = $state<AnchoredVirtualListScrollHandle | null>(null);
  let scrollState = $state<AnchoredVirtualListScrollStateSnapshot | undefined>(undefined);
  let atLatest = $state(true);
  let atStart = $state(false);
  let interactionLog = $state<TransitionEntry[]>([]);

  let interactionLogStore: TransitionEntry[] = [];

  const middleSelector = $derived.by(() => {
    const middle = items[Math.floor(items.length / 2)];
    return middle ? `[data-anchored-evidence-row-id="${middle.id}"]` : null;
  });
  let unsubscribeScrollState: (() => void) | null = null;

  const serializeTarget = (
    target: AnchoredVirtualListResolvedTarget | AnchoredVirtualListScrollStateSnapshot["eventualScrollPosition"]["target"] | null,
  ): SerializedTarget => {
    if (!target) {
      return null;
    }
    switch (target.kind) {
      case "edge":
        return { kind: "edge", edge: target.edge };
      case "position":
        return {
          kind: "position",
          left: "left" in target ? (target.left ?? null) : null,
          top: "top" in target ? (target.top ?? null) : null,
        };
      case "element": {
        const element = "element" in target ? target.element : null;
        const rowIdText =
          element instanceof HTMLElement ? element.dataset.anchoredEvidenceRowId ?? null : null;
        return {
          kind: "element",
          rowId: rowIdText ? Number(rowIdText) : null,
          selector: "selector" in target ? (target.selector ?? null) : null,
        };
      }
    }
  };

  const readVisibleRows = (): VisibleRowsSnapshot => {
    const viewport = viewportRef;
    if (!(viewport instanceof HTMLElement)) {
      return { center: null, first: null, last: null };
    }
    const viewportRect = viewport.getBoundingClientRect();
    const rows = Array.from(
      viewport.querySelectorAll<HTMLElement>("[data-anchored-evidence-row-id]"),
    ).filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom >= viewportRect.top && rect.top <= viewportRect.bottom;
    });
    if (rows.length === 0) {
      return { center: null, first: null, last: null };
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
    return {
      center: centerRow ? Number(centerRow.dataset.anchoredEvidenceRowId ?? Number.NaN) : null,
      first: Number(rows[0]?.dataset.anchoredEvidenceRowId ?? Number.NaN) || null,
      last: Number(rows.at(-1)?.dataset.anchoredEvidenceRowId ?? Number.NaN) || null,
    };
  };

  const captureSnapshot = (): AnchoredEvidenceSnapshot | null => {
    const viewport = viewportRef;
    if (!(viewport instanceof HTMLElement)) {
      return null;
    }
    return {
      atLatest,
      atStart,
      currentScrollTarget: serializeTarget((scrollState?.currentScrollTarget as AnchoredVirtualListResolvedTarget | null) ?? null),
      distanceToLatest: getBottomAnchoredDistanceToLatest(viewport),
      distanceToStart: getBottomAnchoredDistanceToStart(viewport),
      eventualScrollPosition: serializeTarget(scrollState?.eventualScrollPosition.target ?? null),
      itemCount: items.length,
      lastTerminalState: scrollState?.lastTerminalState ?? null,
      phase: scrollState?.phase ?? "idle",
      scrollHeight: viewport.scrollHeight,
      scrollTop: viewport.scrollTop,
      userInputActive: scrollState?.userInput.active ?? false,
      userInputKind: scrollState?.userInput.kind ?? "idle",
      visibleRows: readVisibleRows(),
    };
  };

  const focusViewport = (): void => {
    if (!viewportRef) {
      return;
    }
    viewportRef.tabIndex = 0;
    viewportRef.focus();
  };

  const waitForHarnessSettle = async (): Promise<void> => {
    await tick();
    if (scrollHandleRef) {
      await scrollHandleRef.awaitSettle();
    }
    await waitForAnimationFrames(3);
  };

  const revealMiddle = async (): Promise<void> => {
    if (!middleSelector) {
      return;
    }
    await scrollHandleRef?.request({
      behavior: "auto",
      debugLabel: "anchored-evidence-reveal-middle",
      intent: "reveal",
      target: { kind: "element", selector: middleSelector },
    });
    await waitForHarnessSettle();
  };

  const seekStart = async (): Promise<void> => {
    await scrollHandleRef?.request({
      behavior: "auto",
      debugLabel: "anchored-evidence-seek-start",
      intent: "seek",
      target: { kind: "edge", edge: "start" },
    });
    await waitForHarnessSettle();
  };

  const appendTransitionLog = (snapshot: AnchoredVirtualListScrollStateSnapshot): void => {
    const nextEntry: TransitionEntry = {
      phase: snapshot.phase,
      timestampMs: typeof performance !== "undefined" ? performance.now() : Date.now(),
      userInputKind: snapshot.userInput.kind,
    };
    const previous = interactionLogStore.at(-1);
    if (
      previous?.phase === nextEntry.phase &&
      previous.userInputKind === nextEntry.userInputKind
    ) {
      return;
    }
    interactionLogStore = [...interactionLogStore.slice(-23), nextEntry];
    interactionLog = interactionLogStore;
  };

  const resetHarness = async (): Promise<void> => {
    items = createInitialItems();
    nextLatestId = (items.at(-1)?.id ?? 0) + 1;
    nextOlderId = 0;
    interactionLogStore = [];
    interactionLog = [];
    await tick();
    focusViewport();
    await waitForAnimationFrames(2);
    if (viewportRef) {
      viewportRef.scrollTop = 0;
    }
    await waitForAnimationFrames(2);
  };

  const finalizeMutation = async (
    mutation: MutationEvidence["mutation"],
    transaction: AnchoredVirtualListScrollTransactionResult | null,
  ): Promise<MutationEvidence> => {
    await waitForHarnessSettle();
    return {
      mutation,
      snapshot: captureSnapshot()!,
      transactionTerminalState: transaction?.terminalState ?? null,
    };
  };

  const appendLatest = async (): Promise<MutationEvidence> => {
    items = appendAnchoredLatestRow(items, nextLatestId);
    nextLatestId += 1;
    await tick();
    const transaction = await scrollHandleRef?.notifyMutation({
      debugLabel: "anchored-evidence-append",
      kind: "append",
    });
    return finalizeMutation("append", transaction ?? null);
  };

  const prependOlder = async (): Promise<MutationEvidence> => {
    const prepended = prependAnchoredOlderRows(items, nextOlderId);
    items = prepended.nextItems;
    nextOlderId = prepended.nextOlderId;
    await tick();
    return finalizeMutation("prepend", null);
  };

  const resizeLatest = async (): Promise<MutationEvidence> => {
    items = resizeAnchoredLatestRow(items);
    await tick();
    const transaction = await scrollHandleRef?.notifyMutation({
      debugLabel: "anchored-evidence-resize",
      kind: "resize",
    });
    return finalizeMutation("resize", transaction ?? null);
  };

  const collapseLatest = async (): Promise<MutationEvidence> => {
    items = collapseAnchoredLatestRow(items);
    await tick();
    const transaction = await scrollHandleRef?.notifyMutation({
      debugLabel: "anchored-evidence-collapse",
      kind: "collapse",
    });
    return finalizeMutation("collapse", transaction ?? null);
  };

  $effect(() => {
    if (viewportRef) {
      viewportRef.tabIndex = 0;
      viewportRef.setAttribute("aria-label", "Anchored scroll evidence viewport");
    }
  });

  $effect(() => {
    unsubscribeScrollState?.();
    if (!scrollHandleRef) {
      return;
    }
    unsubscribeScrollState = scrollHandleRef.subscribe((snapshot) => {
      appendTransitionLog(snapshot);
    });
    return () => {
      unsubscribeScrollState?.();
      unsubscribeScrollState = null;
    };
  });

  $effect(() => {
    window.__reverseFlowPerf = {
      appendAnchoredEvidence: appendLatest,
      collapseAnchoredEvidence: collapseLatest,
      focusAnchoredEvidenceViewport: focusViewport,
      getAnchoredEvidenceLog: () => interactionLogStore,
      getAnchoredEvidenceSnapshot: captureSnapshot,
      prependAnchoredEvidence: prependOlder,
      revealAnchoredEvidenceMiddle: revealMiddle,
      seekAnchoredEvidenceStart: seekStart,
      resetAnchoredEvidence: resetHarness,
      resizeAnchoredEvidence: resizeLatest,
    };
    return () => {
      delete window.__reverseFlowPerf;
    };
  });
</script>

<div
  class="perf-anchored-shell grid h-[48rem] min-h-0 gap-4 rounded-[1.35rem] border border-border/70 bg-background p-4"
  data-testid="perf-anchored-evidence"
>
  <div class="sr-only" data-testid="perf-anchored-ready">{viewportRef && scrollHandleRef ? "yes" : "no"}</div>
  <div class="perf-anchored-body grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
    <section class="perf-anchored-panel rounded-[1.3rem] border border-border/70 bg-background/95 p-3 shadow-sm">
      <div class="perf-anchored-viewport-shell">
        <AnchoredVirtualList
          class="h-full"
          viewportClass="rounded-[1rem] border border-border/60 bg-muted/15 p-4"
          viewportTestId="anchored-evidence-viewport"
          bind:viewportRef
          bind:scrollHandleRef
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
        >
          {#snippet start()}
            <div class="pb-2 text-center text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              Visual top / history start
            </div>
          {/snippet}

          {#snippet item(row)}
            <article
              class={`rounded-[1rem] border px-4 py-3 shadow-sm ${
                row.tone === "older"
                  ? "border-amber-300/40 bg-amber-50/70"
                  : row.tone === "latest"
                    ? "border-emerald-300/45 bg-emerald-50/70"
                    : "border-border/70 bg-background"
              }`}
              data-anchored-evidence-row-id={row.id}
            >
              <div class="flex items-center justify-between gap-3">
                <strong class="text-sm font-medium">{row.title}</strong>
                <span class="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  {row.collapsed ? "collapsed" : "expanded"}
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

    <aside class="perf-anchored-panel rounded-[1.3rem] border border-border/70 bg-background/95 p-4 shadow-sm">
      <h3 class="text-sm font-medium">Anchored scroll evidence</h3>
      <p class="mt-2 text-xs text-muted-foreground">
        The harness exposes controller state, visible anchor rows, and mutation outcomes so browser traces can explain
        user-input arbitration instead of relying on subjective judgment.
      </p>
      <pre class="mt-4 overflow-auto rounded-[1rem] border border-border/60 bg-muted/20 p-3 text-[11px] leading-5">
{JSON.stringify(captureSnapshot(), null, 2)}</pre
      >
    </aside>
  </div>
</div>

<style>
  .perf-anchored-shell,
  .perf-anchored-body,
  .perf-anchored-panel,
  .perf-anchored-viewport-shell {
    min-block-size: 0;
  }

  .perf-anchored-viewport-shell {
    block-size: 40rem;
  }
</style>

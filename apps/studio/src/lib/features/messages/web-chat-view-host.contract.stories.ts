import { getBottomAnchoredDistanceToLatest } from "@agenter/svelte-components";
import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { containsVisibleTextDeep } from "$lib/testing/shadow-dom";
import type { WebChatVisibleMessageFact } from "@agenter/web-chat-view";
import Harness from "./web-chat-view-host.story-harness.svelte";

type HarnessState = {
  loadedMessageCount: number;
  transportAppendCount: number;
  pageRequestCount: number;
  pendingOlderCount: number;
  latestVisibleMessage: WebChatVisibleMessageFact | null;
  clientPayloadTypes: string[];
  viewport: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    atLatest: string | null;
    atStart: string | null;
    latestAffordanceVisible: string | null;
  } | null;
};

const readHarnessState = (canvas: ReturnType<typeof within>): HarnessState =>
  JSON.parse(canvas.getByTestId("web-chat-story-state").textContent ?? "{}") as HarnessState;

const readLatestAffordance = (canvas: ReturnType<typeof within>): string | null =>
  canvas.getByTestId("web-chat-story-root").getAttribute("data-debug-latest-affordance");

const expectLatestAffordanceHidden = (canvas: ReturnType<typeof within>): void => {
  expect(readLatestAffordance(canvas)).toBe("false");
  expect(canvas.queryByRole("button", { name: "Scroll to latest" })).toBeNull();
};

const waitForInitialTransport = async (
  canvas: ReturnType<typeof within>,
  canvasElement: HTMLElement,
  options: {
    loadedMessageCount?: number;
    pendingOlderCount: number;
    latestMessageId: number;
  },
): Promise<HarnessState> => {
  let snapshot = readHarnessState(canvas);
  await waitFor(() => {
    snapshot = readHarnessState(canvas);
    expect(canvasElement.querySelector("[data-testid='web-chat-scroll-viewport']")).not.toBeNull();
    expect(snapshot.loadedMessageCount).toBe(options.loadedMessageCount ?? 28);
    expect(snapshot.pendingOlderCount).toBe(options.pendingOlderCount);
    expect(snapshot.latestVisibleMessage?.messageId).toBe(options.latestMessageId);
  });
  return snapshot;
};

const getViewport = (canvasElement: HTMLElement): HTMLDivElement => {
  const viewport = canvasElement.querySelector<HTMLDivElement>("[data-testid='web-chat-scroll-viewport']");
  expect(viewport).not.toBeNull();
  return viewport!;
};

const waitForAnimationFrame = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
};

const getVisibleMessageRows = (root: HTMLElement, viewport: HTMLElement): HTMLElement[] => {
  const viewportRect = viewport.getBoundingClientRect();
  return Array.from(root.querySelectorAll<HTMLElement>("[data-view-key]")).filter((row) => {
    const rect = row.getBoundingClientRect();
    return rect.bottom > viewportRect.top + 8 && rect.top < viewportRect.bottom - 8;
  });
};

const readCenteredVisibleMessageViewKey = (root: HTMLElement, viewport: HTMLElement): string | null => {
  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.top + viewportRect.height / 2;
  const candidates = getVisibleMessageRows(root, viewport)
    .map((row) => {
      const rect = row.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, viewportRect.top);
      const visibleBottom = Math.min(rect.bottom, viewportRect.bottom);
      return {
        viewKey: row.dataset.viewKey ?? null,
        centerDistance: Math.abs((visibleTop + visibleBottom) / 2 - viewportCenter),
      };
    })
    .filter((candidate): candidate is { viewKey: string; centerDistance: number } => candidate.viewKey !== null)
    .sort((left, right) => left.centerDistance - right.centerDistance);
  return candidates[0]?.viewKey ?? null;
};

const readMessageRow = (root: HTMLElement, viewKey: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-view-key="${viewKey}"]`);

const readStableVisibleMessageRow = (
  root: HTMLElement,
  viewport: HTMLElement,
  excludedViewKeys: readonly string[] = [],
): HTMLElement | null => {
  const viewportRect = viewport.getBoundingClientRect();
  const viewportCenter = viewportRect.top + viewportRect.height / 2;
  const excluded = new Set(excludedViewKeys);
  const candidates = getVisibleMessageRows(root, viewport)
    .filter((row) => {
      const viewKey = row.dataset.viewKey;
      return typeof viewKey === "string" && !excluded.has(viewKey);
    })
    .map((row) => {
      const rect = row.getBoundingClientRect();
      const visibleTop = Math.max(rect.top, viewportRect.top);
      const visibleBottom = Math.min(rect.bottom, viewportRect.bottom);
      return {
        row,
        centerDistance: Math.abs((visibleTop + visibleBottom) / 2 - viewportCenter),
      };
    })
    .sort((left, right) => left.centerDistance - right.centerDistance);
  return candidates[0]?.row ?? getVisibleMessageRows(root, viewport)[0] ?? null;
};

const readMessageRowTop = (root: HTMLElement, viewKey: string): number | null => {
  const row = readMessageRow(root, viewKey);
  return row ? row.getBoundingClientRect().top : null;
};

const captureMessageRowTopSamples = async (root: HTMLElement, viewKey: string, frameCount = 32): Promise<number[]> => {
  const samples: number[] = [];
  for (let frame = 0; frame < frameCount; frame += 1) {
    const top = readMessageRowTop(root, viewKey);
    if (top !== null) {
      samples.push(top);
    }
    await waitForAnimationFrame();
  }
  return samples;
};

const meta = {
  title: "Features/Messages/WebChatViewHost/Contracts",
  component: Harness,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Consumer-level Storybook contracts for the shared bottom-anchored chat transcript. These scenarios validate latest affordance, away-from-latest preservation, and older-page loading on the real host surface.",
      },
    },
  },
  render: (args) => ({
    Component: Harness,
    props: args,
  }),
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TransportAppendWhilePinnedKeepsLatestVisible = {
  args: {
    olderPageCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForInitialTransport(canvas, canvasElement, {
      pendingOlderCount: 0,
      latestMessageId: 28,
    });
    expect(readHarnessState(canvas).viewport?.latestAffordanceVisible).toBe("false");

    await userEvent.click(canvas.getByTestId("web-chat-story-push-latest"));

    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(state.transportAppendCount).toBe(1);
      expect(state.loadedMessageCount).toBe(29);
      expect(state.latestVisibleMessage?.messageId).toBe(29);
      expect(state.viewport?.latestAffordanceVisible).toBe("false");
      expect(containsVisibleTextDeep(canvasElement, "Transport append #1")).toBe(true);
    });

    const latestRow = canvasElement.querySelector<HTMLElement>("[data-view-key='29']");
    expect(latestRow?.dataset.insertMotion).toBe("latest");
  },
} satisfies Story;

export const TransportAppendWhilePinnedPreservesExistingRowDomIdentity = {
  args: {
    olderPageCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const initialState = await waitForInitialTransport(canvas, canvasElement, {
      pendingOlderCount: 0,
      latestMessageId: 28,
    });
    const viewport = getViewport(canvasElement);
    const pinnedLatestViewKey = initialState.latestVisibleMessage?.viewKey
      ? initialState.latestVisibleMessage.viewKey
      : initialState.latestVisibleMessage?.messageId
        ? String(initialState.latestVisibleMessage.messageId)
        : null;
    const anchoredRowBefore = await waitFor(() => {
      const row = readStableVisibleMessageRow(
        canvasElement,
        viewport,
        pinnedLatestViewKey ? [pinnedLatestViewKey] : [],
      );
      if (!row) {
        throw new Error("Unable to resolve an existing visible row before transport append.");
      }
      return row;
    });
    const anchoredViewKey = anchoredRowBefore.dataset.viewKey;
    expect(anchoredViewKey).not.toBeNull();

    await userEvent.click(canvas.getByTestId("web-chat-story-push-latest"));

    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(state.transportAppendCount).toBe(1);
      expect(state.loadedMessageCount).toBe(29);
      expect(state.latestVisibleMessage?.messageId).toBe(29);
    });
    await waitForAnimationFrame();
    await waitForAnimationFrame();

    const anchoredRowAfter = readMessageRow(canvasElement, anchoredViewKey!);
    expect(anchoredRowAfter).not.toBeNull();
    expect(anchoredRowAfter?.isSameNode(anchoredRowBefore) ?? false).toBe(true);
  },
} satisfies Story;

export const EmptyTranscriptKeepsLatestAffordanceHidden = {
  args: {
    olderPageCount: 0,
    seedMessageCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(state.loadedMessageCount).toBe(0);
      expect(state.viewport?.clientHeight).toBeGreaterThan(0);
    });
    expectLatestAffordanceHidden(canvas);
    expect(containsVisibleTextDeep(canvasElement, "No messages yet")).toBe(true);
  },
} satisfies Story;

export const EmbeddedAvatarImagesStayBounded = {
  args: {
    olderPageCount: 0,
    seedMessageCount: 5,
    useLargeAvatarImages: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForInitialTransport(canvas, canvasElement, {
      loadedMessageCount: 5,
      pendingOlderCount: 0,
      latestMessageId: 5,
    });

    await waitFor(() => {
      const avatars = Array.from(canvasElement.querySelectorAll<HTMLElement>("[part~='message-avatar']"));
      expect(avatars.length).toBeGreaterThan(0);
      for (const avatar of avatars.slice(0, 5)) {
        const rect = avatar.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(20);
        expect(rect.width).toBeLessThanOrEqual(34);
        expect(rect.height).toBeGreaterThanOrEqual(20);
        expect(rect.height).toBeLessThanOrEqual(34);
      }

      const avatarImage = canvasElement.querySelector<HTMLImageElement>("[part~='message-avatar'] img");
      expect(avatarImage).not.toBeNull();
      const imageRect = avatarImage!.getBoundingClientRect();
      expect(imageRect.width).toBeLessThanOrEqual(34);
      expect(imageRect.height).toBeLessThanOrEqual(34);
    });
  },
} satisfies Story;

export const EmbeddedReadIndicatorsStayBounded = {
  args: {
    olderPageCount: 0,
    seedMessageCount: 5,
    showReadProgress: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForInitialTransport(canvas, canvasElement, {
      loadedMessageCount: 5,
      pendingOlderCount: 0,
      latestMessageId: 5,
    });

    await waitFor(() => {
      const indicators = Array.from(
        canvasElement.querySelectorAll<HTMLElement>("[data-testid='message-read-indicator']"),
      );
      expect(indicators.length).toBeGreaterThan(0);
      for (const indicator of indicators.slice(0, 5)) {
        const rect = indicator.getBoundingClientRect();
        expect(rect.width).toBeGreaterThanOrEqual(16);
        expect(rect.width).toBeLessThanOrEqual(26);
        expect(rect.height).toBeGreaterThanOrEqual(16);
        expect(rect.height).toBeLessThanOrEqual(26);
        const ring = indicator.querySelector<SVGElement>(".message-read-ring");
        expect(ring).not.toBeNull();
        const ringRect = ring!.getBoundingClientRect();
        expect(ringRect.width).toBeLessThanOrEqual(26);
        expect(ringRect.height).toBeLessThanOrEqual(26);
      }
    });
  },
} satisfies Story;

export const ContainedTranscriptKeepsLatestAffordanceHidden = {
  args: {
    olderPageCount: 0,
    seedMessageCount: 1,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(state.loadedMessageCount).toBe(1);
      expect(state.viewport?.clientHeight).toBeGreaterThan(0);
      expect(state.viewport?.scrollHeight).toBeLessThanOrEqual((state.viewport?.clientHeight ?? 0) + 1);
    });
    expectLatestAffordanceHidden(canvas);
    expect(containsVisibleTextDeep(canvasElement, "Welcome from transport")).toBe(true);
  },
} satisfies Story;

export const TransportAppendWhileAwayKeepsAffordanceVisible = {
  args: {
    olderPageCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForInitialTransport(canvas, canvasElement, {
      pendingOlderCount: 0,
      latestMessageId: 28,
    });
    const viewport = getViewport(canvasElement);
    await userEvent.click(canvas.getByTestId("web-chat-story-scroll-away"));

    await waitFor(
      () => {
        expect(readLatestAffordance(canvas)).toBe("true");
      },
      { timeout: 3_000 },
    );
    const anchoredViewKey = readCenteredVisibleMessageViewKey(canvasElement, viewport);
    expect(anchoredViewKey).not.toBeNull();
    const anchoredTopBeforeAppend = anchoredViewKey ? readMessageRowTop(canvasElement, anchoredViewKey) : null;
    expect(anchoredTopBeforeAppend).not.toBeNull();

    await userEvent.click(canvas.getByTestId("web-chat-story-push-latest"));

    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(state.transportAppendCount).toBe(1);
      expect(state.loadedMessageCount).toBe(29);
      expect(state.latestVisibleMessage?.messageId).not.toBe(29);
      expect(readLatestAffordance(canvas)).toBe("true");
    });
    const anchorTopSamples =
      anchoredViewKey === null ? [] : await captureMessageRowTopSamples(canvasElement, anchoredViewKey);
    const maxAnchorDrift = anchorTopSamples.length
      ? Math.max(...anchorTopSamples.map((top) => Math.abs(top - (anchoredTopBeforeAppend ?? 0))))
      : Number.POSITIVE_INFINITY;
    expect(maxAnchorDrift).toBeLessThanOrEqual(16);
    expect(getBottomAnchoredDistanceToLatest(viewport)).toBeGreaterThan(48);
    expect(readMessageRowTop(canvasElement, anchoredViewKey!)).not.toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: "Scroll to latest" }));

    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(state.latestVisibleMessage?.messageId).toBe(29);
      expect(readLatestAffordance(canvas)).toBe("false");
      expect(containsVisibleTextDeep(canvasElement, "Transport append #1")).toBe(true);
    });
  },
} satisfies Story;

export const ReachingHistoryStartLoadsOlderPage = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForInitialTransport(canvas, canvasElement, {
      pendingOlderCount: 6,
      latestMessageId: 34,
    });
    await userEvent.click(canvas.getByTestId("web-chat-story-reach-start"));

    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(state.pageRequestCount).toBe(1);
      expect(state.loadedMessageCount).toBe(34);
      expect(state.pendingOlderCount).toBe(0);
      expect(containsVisibleTextDeep(canvasElement, "Older history #1")).toBe(true);
    });

    const olderRow = canvasElement.querySelector<HTMLElement>("[data-view-key='1']");
    expect(olderRow?.dataset.insertMotion).toBe("older");
  },
} satisfies Story;

export const ScrollToLatestInterruptedByWheelKeepsTranscriptAway = {
  args: {
    olderPageCount: 0,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitForInitialTransport(canvas, canvasElement, {
      pendingOlderCount: 0,
      latestMessageId: 28,
    });
    const viewport = getViewport(canvasElement);
    await userEvent.click(canvas.getByTestId("web-chat-story-scroll-away"));

    let awayState = readHarnessState(canvas);
    await waitFor(
      () => {
        awayState = readHarnessState(canvas);
        expect(readLatestAffordance(canvas)).toBe("true");
        expect(awayState.latestVisibleMessage?.messageId).not.toBe(28);
      },
      { timeout: 3_000 },
    );

    await userEvent.click(canvas.getByRole("button", { name: "Scroll to latest" }));
    await waitForAnimationFrame();

    viewport.dispatchEvent(new Event("wheel"));
    await userEvent.click(canvas.getByTestId("web-chat-story-scroll-away"));

    await waitFor(() => {
      const state = readHarnessState(canvas);
      expect(readLatestAffordance(canvas)).toBe("true");
      expect(state.latestVisibleMessage?.messageId).not.toBe(28);
    });
  },
} satisfies Story;

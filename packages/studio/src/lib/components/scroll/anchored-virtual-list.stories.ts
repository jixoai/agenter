import type { Meta, StoryObj } from "@storybook/sveltekit";
import { expect, userEvent, waitFor, within } from "storybook/test";

import Harness from "./anchored-virtual-list.story-harness.svelte";

type HarnessState = {
  phase: string | null;
  atLatest: boolean;
  atStart: boolean;
  itemCount: number;
  distanceToLatest: number | null;
  distanceToStart: number | null;
  userInput: {
    kind: string;
    pointerType: string | null;
  };
  activeTx: {
    id: string;
    priority: string;
    interruptionPolicy: string;
    startedAt: number;
    debugLabel?: string;
  } | null;
  currentScrollTarget: Record<string, unknown> | null;
  visibleRows: {
    center: number | null;
    first: number | null;
    last: number | null;
    trailing: number | null;
  };
  lastMutation: {
    mutation: string | null;
    terminalState: string | null;
  };
  lastCommand: {
    command: string | null;
    terminalState: string | null;
  };
};

const readHarnessState = (canvas: ReturnType<typeof within>): HarnessState =>
  JSON.parse(canvas.getByTestId("anchored-virtual-list-state").textContent ?? "{}") as HarnessState;

const waitForMutation = async (
  canvas: ReturnType<typeof within>,
  mutation: "append" | "prepend",
  terminalState = "completed",
): Promise<HarnessState> => {
  let snapshot = readHarnessState(canvas);
  await waitFor(() => {
    snapshot = readHarnessState(canvas);
    expect(snapshot.lastMutation.mutation).toBe(mutation);
    expect(snapshot.lastMutation.terminalState).toBe(terminalState);
  });
  return snapshot;
};

const waitForCommand = async (
  canvas: ReturnType<typeof within>,
  command: "pinLatest" | "seekLatest" | "seekStart" | "revealMiddle" | "reset",
  terminalState = "completed",
): Promise<HarnessState> => {
  let snapshot = readHarnessState(canvas);
  await waitFor(() => {
    snapshot = readHarnessState(canvas);
    expect(snapshot.lastCommand.command).toBe(command);
    expect(snapshot.lastCommand.terminalState).toBe(terminalState);
  });
  return snapshot;
};

const waitForAnimationFrame = async (): Promise<void> => {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
};

const waitForStartEdge = async (canvas: ReturnType<typeof within>): Promise<void> => {
  await waitFor(
    () => {
      expect(readHarnessState(canvas).atStart).toBe(true);
    },
    { timeout: 8_000 },
  );
};

const waitForNoActiveTx = async (canvas: ReturnType<typeof within>): Promise<void> => {
  await waitFor(() => {
    expect(readHarnessState(canvas).activeTx).toBeNull();
  });
};

const captureMutationStates = async (
  canvas: ReturnType<typeof within>,
  mutation: "append" | "prepend",
  options: { extraFrames?: number; maxFrames?: number } = {},
): Promise<HarnessState[]> => {
  const { extraFrames = 8, maxFrames = 180 } = options;
  const samples: HarnessState[] = [];
  for (let frame = 0; frame < maxFrames; frame += 1) {
    samples.push(readHarnessState(canvas));
    const current = samples[samples.length - 1];
    if (current?.lastMutation.mutation === mutation && current.lastMutation.terminalState === "completed") {
      for (let settleFrame = 0; settleFrame < extraFrames; settleFrame += 1) {
        await waitForAnimationFrame();
        samples.push(readHarnessState(canvas));
      }
      return samples;
    }
    await waitForAnimationFrame();
  }
  throw new Error(`Timed out waiting for ${mutation} mutation samples.`);
};

const meta = {
  title: "Primitives/Scroll/AnchoredVirtualList",
  component: Harness,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Capability lab for the shared anchored virtual list scroll law. Use the controls plus manual wheel/keyboard/touch input to inspect semantic state, visible anchor rows, and mutation outcomes in Storybook.",
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

export const InteractivePlayground = {
  name: "Capability Lab",
  parameters: {
    docs: {
      description: {
        story:
          "Primary acceptance surface: verify transaction-closure append/prepend choreography, resize, collapse, and edge recovery here. Manual checks: append near latest should smooth-follow latest, prepend near start should reveal the nearest inserted older row, then validate wheel and touch input paths.",
      },
    },
  },
} satisfies Story;

export const InternalScrollOwnerHasOverflow = {
  name: "Internal Scroll Owner Has Overflow",
  parameters: {
    docs: {
      description: {
        story:
          "Regression contract for the capability lab shell. The middle transcript pane must own overflow from first paint; if it expands to content height, every append/prepend/input arbitration scenario becomes a false positive.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const initial = readHarnessState(canvas);
      expect(initial.atLatest).toBe(true);
      expect(initial.atStart).toBe(false);
      expect(initial.distanceToLatest).not.toBeNull();
      expect(initial.distanceToStart).not.toBeNull();
      expect(initial.distanceToLatest!).toBeLessThanOrEqual(4);
      expect(initial.distanceToStart!).toBeGreaterThan(72);
    });
  },
} satisfies Story;

export const ContractRun = {
  name: "Contract Run",
  parameters: {
    docs: {
      description: {
        story:
          "Automation-only contract story. It drives append-follow-latest and prepend-reveal-nearest-older through the shared transaction closure API so Storybook DOM tests can assert the semantic state surface stays inspectable.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const initial = readHarnessState(canvas);
      expect(initial.atLatest).toBe(true);
      expect(initial.atStart).toBe(false);
      expect(initial.distanceToStart).not.toBeNull();
      expect(initial.distanceToStart!).toBeGreaterThan(72);
    });

    await userEvent.click(canvas.getByTestId("avl-append-latest"));
    const appendedState = await waitForMutation(canvas, "append");
    await waitForNoActiveTx(canvas);
    expect(appendedState.itemCount).toBe(25);
    expect(appendedState.atLatest).toBe(true);
    expect(
      [appendedState.visibleRows.last, appendedState.visibleRows.trailing].includes(25),
    ).toBe(true);

    await userEvent.click(canvas.getByTestId("avl-seek-start"));
    await waitForStartEdge(canvas);
    await userEvent.click(canvas.getByTestId("avl-prepend-older"));

    const state = await waitForMutation(canvas, "prepend");
    expect(state.itemCount).toBe(27);
    expect([state.visibleRows.first, state.visibleRows.center, state.visibleRows.last].includes(0)).toBe(true);
  },
} satisfies Story;

export const AppendNearLatestAutoFollow = {
  name: "Append Near Latest Auto Follow",
  parameters: {
    docs: {
      description: {
        story:
          "Append a latest row while already pinned near the latest edge. The shared transaction should preserve the viewport during insertion and then finish back at the latest edge without route-local math.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const initial = readHarnessState(canvas);
      expect(initial.atLatest).toBe(true);
      expect(initial.atStart).toBe(false);
      expect(initial.itemCount).toBe(24);
      expect(initial.distanceToStart).not.toBeNull();
      expect(initial.distanceToStart!).toBeGreaterThan(72);
    });

    await userEvent.click(canvas.getByTestId("avl-append-latest"));
    const state = await waitForMutation(canvas, "append");
    expect(state.atLatest).toBe(true);
    expect(state.itemCount).toBe(25);
    expect(state.distanceToLatest).not.toBeNull();
    expect(state.distanceToLatest!).toBeLessThanOrEqual(4);
    expect([state.visibleRows.last, state.visibleRows.trailing].includes(25)).toBe(true);
  },
} satisfies Story;

export const PrependNearStartRevealOlder = {
  name: "Prepend Near Start Reveal Older",
  parameters: {
    docs: {
      description: {
        story:
          "Seek to the history start, prepend older rows, and verify the transaction reveals the nearest inserted older row rather than leaving the viewport stranded at an absolute edge.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const initial = readHarnessState(canvas);
      expect(initial.atLatest).toBe(true);
      expect(initial.atStart).toBe(false);
      expect(initial.distanceToStart).not.toBeNull();
      expect(initial.distanceToStart!).toBeGreaterThan(72);
    });

    await userEvent.click(canvas.getByTestId("avl-seek-start"));
    await waitForStartEdge(canvas);

    await userEvent.click(canvas.getByTestId("avl-prepend-older"));
    const state = await waitForMutation(canvas, "prepend");
    expect(state.itemCount).toBe(26);
    expect(
      [state.visibleRows.first, state.visibleRows.center, state.visibleRows.last].includes(0),
    ).toBe(true);
  },
} satisfies Story;

export const AppendAvoidsStaleIntermediateRows = {
  name: "Append Avoids Stale Intermediate Rows",
  parameters: {
    docs: {
      description: {
        story:
          "Regression contract for the append race. While a latest row is appended near the latest edge, the visible trailing row sequence must remain monotonic instead of jumping backward to an older stale row before settling.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    let initialState = readHarnessState(canvas);
    await waitFor(() => {
      initialState = readHarnessState(canvas);
      expect(initialState.atLatest).toBe(true);
      expect(initialState.atStart).toBe(false);
      expect(initialState.itemCount).toBe(24);
      expect(initialState.visibleRows.trailing).not.toBeNull();
      expect(initialState.distanceToStart).not.toBeNull();
      expect(initialState.distanceToStart!).toBeGreaterThan(72);
    });

    await userEvent.click(canvas.getByTestId("avl-append-latest"));
    const samples = await captureMutationStates(canvas, "append");
    const visibleTrailingRows = samples
      .map((snapshot) => snapshot.visibleRows.trailing)
      .filter((rowId): rowId is number => rowId !== null);

    expect(visibleTrailingRows.at(-1)).toBe(25);
    expect(Math.min(...visibleTrailingRows)).toBeGreaterThanOrEqual(initialState.visibleRows.trailing ?? 0);
    expect(
      visibleTrailingRows.every((rowId, index) => index === 0 || rowId >= visibleTrailingRows[index - 1]!),
    ).toBe(true);
  },
} satisfies Story;

export const SeekLatestInterruptedByKeyboard = {
  name: "Seek Latest Interrupted By Keyboard",
  parameters: {
    docs: {
      description: {
        story:
          "Regression contract for explicit semantic requests. A keyboard gesture that begins while seek-latest is in flight must interrupt the request instead of letting a second writer finish the scroll behind user input.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByTestId("avl-seek-start"));
    await waitForStartEdge(canvas);

    await userEvent.click(canvas.getByTestId("avl-seek-latest"));
    await waitFor(
      () => {
        const state = readHarnessState(canvas);
        expect(state.phase).not.toBe("idle");
        expect(state.currentScrollTarget?.kind).toBe("edge");
        expect(state.currentScrollTarget?.edge).toBe("latest");
      },
      { timeout: 4_000 },
    );
    await waitForAnimationFrame();
    await userEvent.click(canvas.getByTestId("avl-interrupt-keyboard"));

    const state = await waitForCommand(canvas, "seekLatest", "interrupted");
    expect(state.userInput.kind).toBe("keyboard");
    expect(state.atLatest).toBe(false);
  },
} satisfies Story;

export const AppendNearLatestInterruptedByWheel = {
  name: "Append Near Latest Interrupted By Wheel",
  parameters: {
    docs: {
      description: {
        story:
          "Regression contract for append-follow choreography. When latest append is about to smooth-follow the newest row, wheel input must interrupt the transaction and leave the viewport under user ownership.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      const initial = readHarnessState(canvas);
      expect(initial.atLatest).toBe(true);
      expect(initial.itemCount).toBe(24);
    });

    await userEvent.click(canvas.getByTestId("avl-append-latest"));
    await waitForAnimationFrame();
    await userEvent.click(canvas.getByTestId("avl-interrupt-wheel"));

    const state = await waitForMutation(canvas, "append", "interrupted");
    expect(state.itemCount).toBe(25);
    expect(state.userInput.kind).toBe("wheel");
  },
} satisfies Story;

export const PrependNearStartRevealInterruptedByTouch = {
  name: "Prepend Near Start Reveal Interrupted By Touch",
  parameters: {
    docs: {
      description: {
        story:
          "Regression contract for older reveal choreography. When older rows are prepended near history start, direct manipulation must interrupt the reveal instead of competing with it.",
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByTestId("avl-seek-start"));
    await waitFor(() => {
      expect(readHarnessState(canvas).atStart).toBe(true);
    });

    await userEvent.click(canvas.getByTestId("avl-prepend-older"));
    await waitForAnimationFrame();
    await userEvent.click(canvas.getByTestId("avl-interrupt-touch"));

    const state = await waitForMutation(canvas, "prepend", "interrupted");
    expect(state.itemCount).toBe(26);
    expect(state.userInput.kind).toBe("direct-manipulation");
  },
} satisfies Story;

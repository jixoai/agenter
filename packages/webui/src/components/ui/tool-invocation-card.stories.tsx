import type { Meta, StoryObj } from "@storybook/react-vite";

import { ToolInvocationCard, type ToolInvocationView } from "./tool-invocation-card";

const baseInvocation: ToolInvocationView = {
  invocationId: "invocation-1",
  toolName: "terminal_read",
  status: "running",
  startedAt: Date.now(),
  call: {
    value: {
      tool: "terminal_read",
      input: {
        terminalId: "iflow",
        mode: "diff",
      },
    },
  },
};

const meta = {
  title: "Components/UI/ToolInvocationCard",
  component: ToolInvocationCard,
  args: {
    invocation: baseInvocation,
  },
} satisfies Meta<typeof ToolInvocationCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Running: Story = {};

export const Success: Story = {
  args: {
    invocation: {
      ...baseInvocation,
      status: "success",
      result: {
        value: {
          output: {
            kind: "snapshot",
            content: "ok",
          },
        },
      },
      finishedAt: Date.now(),
    },
  },
};

export const Failed: Story = {
  args: {
    invocation: {
      ...baseInvocation,
      status: "failed",
      result: {
        value: {
          ok: false,
          error: "permission denied",
        },
      },
      error: "permission denied",
      finishedAt: Date.now(),
    },
  },
};

export const Cancelled: Story = {
  args: {
    invocation: {
      ...baseInvocation,
      status: "cancelled",
      error: "aborted by session stop",
      finishedAt: Date.now(),
    },
  },
};

export const Waiting: Story = {
  args: {
    invocation: {
      ...baseInvocation,
      status: "waiting",
      call: null,
    },
  },
};

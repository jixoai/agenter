import type { ModelDebugOutput } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";

import { ModelPanel } from "./ModelPanel";

const debug = {
  config: {
    providerId: "deepseek",
    kind: "openai-compatible",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com/v1",
    apiKey: "sk-test",
    temperature: 0.2,
    maxRetries: 1,
    maxToken: 8000,
    compactThreshold: 6000,
    capabilities: {
      imageInput: true,
    },
  },
  history: [
    {
      role: "user",
      name: "User",
      content: [{ type: "text", content: "Please inspect the iflow terminal." }],
    },
    {
      role: "assistant",
      name: "Assistant",
      content: [{ type: "text", content: "I will inspect the terminal output first." }],
    },
  ],
  stats: {
    loops: 2,
    apiCalls: 1,
    lastContextChars: 256,
    totalContextChars: 400,
    lastPromptTokens: 120,
    totalPromptTokens: 240,
  },
  latestModelCall: {
    id: 7,
    cycleId: 4,
    createdAt: 1_709_800_000_000,
    provider: "openai-compatible",
    model: "deepseek-chat",
    request: {
      systemPrompt: "# Agenter\n\nYou are a careful coding assistant.",
      messages: [
        {
          role: "system",
          content: [{ type: "text", content: "Follow the current task queue." }],
        },
        {
          role: "user",
          content: [{ type: "text", content: "Please inspect the iflow terminal." }],
        },
      ],
      tools: [{ name: "terminal_read", description: "Read terminal snapshot." }],
      meta: { cycleId: 4, trigger: "terminal" },
    },
    response: { assistant: { text: "Checking the terminal now." } },
    error: null,
  },
  recentModelCalls: [
    {
      id: 6,
      cycleId: 3,
      createdAt: 1_709_799_000_000,
      provider: "openai-compatible",
      model: "deepseek-chat",
      request: { systemPrompt: "# Previous" },
      response: { assistant: { text: "Previous call" } },
      error: null,
    },
  ],
  recentApiCalls: [
    {
      id: 4,
      modelCallId: 7,
      createdAt: 1_709_800_000_100,
      request: { url: "https://api.deepseek.com/v1/chat/completions", body: { stream: false } },
      response: { id: "resp_1", choices: [{ index: 0 }] },
      error: null,
    },
  ],
} satisfies ModelDebugOutput;

const meta = {
  title: "Features/Model/ModelPanel",
  component: ModelPanel,
  args: {
    debug,
    loading: false,
    error: null,
    onRefresh: fn(),
  },
  render: (args) => (
    <div className="h-[840px] p-6">
      <ModelPanel {...args} />
    </div>
  ),
} satisfies Meta<typeof ModelPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const RichModelDebug: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Provider")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "Latest" }));
    await expect(canvas.getByRole("tab", { name: "Request" })).toBeInTheDocument();
    await userEvent.click(canvas.getByRole("tab", { name: "Tools" }));
    await expect(canvas.getByText("Read terminal snapshot.")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "History" }));
    await userEvent.click(canvas.getByRole("tab", { name: "Calls" }));
    await expect(canvas.getByText("Recent model calls")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("tab", { name: "HTTP" }));
    await expect(canvas.getByText("Recorded HTTP")).toBeInTheDocument();

    await userEvent.click(canvas.getByRole("button", { name: /Refresh/i }));
    await expect(args.onRefresh).toHaveBeenCalledTimes(1);
  },
};

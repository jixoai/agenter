import type { RuntimeAttentionState } from "@agenter/client-sdk";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { deriveAttentionSelection, type AttentionPanelTab, type AttentionSelectionState } from "./attention-view-model";
import { AttentionInspectorPanel } from "./AttentionInspectorPanel";

const contextKzf: RuntimeAttentionState["snapshot"]["contexts"][number] = {
  contextId: "ctx-chat-kzf",
  owner: "avatar:jane",
  content: "## Lunch relay\n\n- kzf asks jane to ask gaubee about lunch.\n- jane is waiting for a reply.",
  contentFormat: "text/markdown",
  scoreMap: {
    a1b2c3: 50,
    d4e5f6: 50,
    relay01: 100,
  },
  headCommitId: "commit-2",
  createdAt: "2026-03-24T10:00:00.000Z",
  updatedAt: "2026-03-24T10:00:10.000Z",
  commits: [
    {
      commitId: "commit-1",
      contextId: "ctx-chat-kzf",
      parentCommitIds: [],
      meta: { author: "user:kzf", source: "message", createdAt: "2026-03-24T10:00:00.000Z" },
      scores: { a1b2c3: 100, d4e5f6: 100 },
      summary: "gaubee在吗？问他中午吃什么？",
      change: { type: "update" as const, value: "kzf asks jane to ask gaubee about lunch.", format: "text/plain" },
      createdAt: "2026-03-24T10:00:00.000Z",
    },
    {
      commitId: "commit-2",
      contextId: "ctx-chat-kzf",
      parentCommitIds: ["commit-1"],
      meta: { author: "avatar:jane", source: "attention", createdAt: "2026-03-24T10:00:10.000Z" },
      scores: { a1b2c3: 50, d4e5f6: 50, relay01: 100 },
      summary: "稍等，我问一下",
      change: {
        type: "update" as const,
        value: "Jane needs to ask gaubee and relay the answer.",
        format: "text/plain",
      },
      createdAt: "2026-03-24T10:00:10.000Z",
    },
  ],
};

const contextGaubee: RuntimeAttentionState["snapshot"]["contexts"][number] = {
  contextId: "ctx-chat-gaubee",
  owner: "avatar:jane",
  content: "## Reply\n\nGaubee replies with **fried rice**.",
  contentFormat: "text/markdown",
  scoreMap: {
    relay01: 0,
    rice123: 100,
  },
  headCommitId: "commit-4",
  createdAt: "2026-03-24T10:00:20.000Z",
  updatedAt: "2026-03-24T10:00:30.000Z",
  commits: [
    {
      commitId: "commit-3",
      contextId: "ctx-chat-gaubee",
      parentCommitIds: ["commit-2"],
      meta: { author: "avatar:jane", source: "attention", createdAt: "2026-03-24T10:00:20.000Z" },
      scores: { relay01: 100 },
      summary: "在吗？kzf 问你中午吃什么？",
      change: { type: "update" as const, value: "Outbound relay to gaubee.", format: "text/plain" },
      createdAt: "2026-03-24T10:00:20.000Z",
    },
    {
      commitId: "commit-4",
      contextId: "ctx-chat-gaubee",
      parentCommitIds: ["commit-3"],
      meta: { author: "user:gaubee", source: "message", createdAt: "2026-03-24T10:00:30.000Z" },
      scores: { relay01: 0, rice123: 100 },
      summary: "中午吃蛋炒饭",
      change: { type: "update" as const, value: "gaubee replies with fried rice.", format: "text/plain" },
      createdAt: "2026-03-24T10:00:30.000Z",
    },
  ],
};

const crossContextAttention: RuntimeAttentionState = {
  snapshot: {
    contexts: [contextKzf, contextGaubee],
  },
  active: [
    {
      contextId: contextKzf.contextId,
      context: {
        contextId: contextKzf.contextId,
        owner: contextKzf.owner,
        content: contextKzf.content,
        contentFormat: contextKzf.contentFormat,
        scoreMap: contextKzf.scoreMap,
        headCommitId: contextKzf.headCommitId,
        createdAt: contextKzf.createdAt,
        updatedAt: contextKzf.updatedAt,
      },
      recentCommits: contextKzf.commits,
    },
    {
      contextId: contextGaubee.contextId,
      context: {
        contextId: contextGaubee.contextId,
        owner: contextGaubee.owner,
        content: contextGaubee.content,
        contentFormat: contextGaubee.contentFormat,
        scoreMap: contextGaubee.scoreMap,
        headCommitId: contextGaubee.headCommitId,
        createdAt: contextGaubee.createdAt,
        updatedAt: contextGaubee.updatedAt,
      },
      recentCommits: contextGaubee.commits,
    },
  ],
  cycleFrames: [
    {
      cycleId: 21,
      seq: 21,
      createdAt: 21,
      wakeSource: "attention",
      protocolMode: "delta",
      inputContextIds: ["ctx-chat-kzf"],
      inputCommitRefs: [{ contextId: "ctx-chat-kzf", commitId: "commit-2" }],
      activeContextIds: ["ctx-chat-kzf", "ctx-chat-gaubee"],
      producedCommitRefs: [{ contextId: "ctx-chat-gaubee", commitId: "commit-3" }],
      modelCallIds: [21],
      hookIds: ["hook-21"],
    },
  ],
  hooks: [
    {
      id: "hook-21",
      cycleId: 21,
      hookId: "message-bridge",
      systemId: "message",
      contextId: "ctx-chat-gaubee",
      commitId: "commit-3",
      status: "delivered",
      createdAt: 22,
      target: { chatId: "chat-gaubee" },
      output: { messageId: "301", attentionContextId: "ctx-chat-gaubee", attentionCommitId: "commit-3" },
    },
  ],
};

const meta = {
  title: "Features/Devtools/AttentionInspectorPanel",
  component: AttentionInspectorPanel,
  args: {
    attention: crossContextAttention,
    loading: false,
    selectedContextId: "ctx-chat-kzf",
    selectedItemId: null,
  },
  render: (args) => {
    const [selection, setSelection] = useState<AttentionSelectionState>(() =>
      deriveAttentionSelection(args.attention ?? crossContextAttention, {
        contextId: args.selectedContextId ?? null,
        itemId: args.selectedItemId ?? null,
      }),
    );
    const [detailView, setDetailView] = useState<AttentionPanelTab>("context");
    const [queryText, setQueryText] = useState("");
    return (
      <div className="space-y-3 p-6">
        <div data-testid="attention-selection-state" className="text-xs text-slate-500">
          {selection.contextId && selection.itemId ? `${selection.contextId}/${selection.itemId}` : "no-selection"}
        </div>
        <div data-testid="attention-route-state" className="text-xs text-slate-500">
          {detailView}:{queryText || "-"}
        </div>
        <div className="h-[720px]">
          <AttentionInspectorPanel
            {...args}
            selectedContextId={selection.contextId}
            selectedItemId={selection.itemId}
            detailView={detailView}
            onDetailViewChange={setDetailView}
            queryText={queryText}
            onQueryTextChange={setQueryText}
            onSelectionChange={setSelection}
          />
        </div>
      </div>
    );
  },
} satisfies Meta<typeof AttentionInspectorPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ContextFirstView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("Attention")).toBeInTheDocument();
    await expect(canvas.getByTestId("attention-context-scroll-viewport")).toBeInTheDocument();
    await expect(canvas.getByTestId("attention-context-detail-scroll-viewport")).toBeInTheDocument();
    await expect(canvas.getByTestId("attention-context-markdown-card")).toHaveTextContent("Lunch relay");
    await expect(canvas.getByTestId("attention-selection-state")).toHaveTextContent("ctx-chat-kzf/commit-2");
    await expect(canvas.getByRole("tab", { name: /Context/i })).toHaveAttribute("data-active", "");
    await expect(canvas.getByRole("tab", { name: /Search/i })).toBeInTheDocument();
    await expect(canvas.getByText(/Context state/i)).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: /relay01/i })).toBeInTheDocument();
  },
};

export const ScoreQueryTraversal: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const getQueryInput = () => canvas.getByRole("textbox", { name: /Search attention/i });

    await userEvent.click(canvas.getByRole("button", { name: /relay01/i }));
    await expect(canvas.getByRole("tab", { name: /Search/i })).toHaveAttribute("data-active", "");
    await expect(canvas.getByTestId("attention-search-results-scroll-viewport")).toBeInTheDocument();
    await waitFor(() => {
      expect(getQueryInput()).toHaveValue("context:ctx-chat-kzf score:relay01 deep:2");
    });
    await expect(canvas.getByTestId("attention-route-state")).toHaveTextContent(
      "search:context:ctx-chat-kzf score:relay01 deep:2",
    );

    await userEvent.clear(getQueryInput());
    await expect(canvas.getByTestId("attention-route-state")).toHaveTextContent("search:-");
    await expect(canvas.getByTestId("attention-search-results-scroll-viewport")).toBeInTheDocument();

    await userEvent.type(getQueryInput(), "score:relay01 deep:2");
    await waitFor(() => {
      expect(canvas.getByTestId("attention-current-search-pill")).toHaveTextContent(/matches/i);
    });
  },
};

export const ItemCommitView: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(canvas.getByRole("tab", { name: /Items/i }));
    await expect(canvas.getByText(/Commit summary/i)).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Metadata" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Scores" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Change" })).toBeInTheDocument();
  },
};

export const LoadingContexts: Story = {
  args: {
    attention: {
      snapshot: { contexts: [] },
      active: [],
      cycleFrames: [],
      hooks: [],
    },
    loading: true,
    selectedContextId: null,
    selectedItemId: null,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Loading contexts...")).toBeInTheDocument();
  },
};

import type {
  GlobalTerminalApprovalRequest,
  GlobalTerminalEntry,
  GlobalTerminalGrantEntry,
  GlobalTerminalGrantIssueOutput,
  TerminalActivityItem,
} from "@agenter/client-sdk";
import { TERMINAL_VIEW_TAG } from "@agenter/terminal-view";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";
import { useState } from "react";

import { GlobalTerminalWorkbench } from "./GlobalTerminalWorkbench";
import type { TerminalActorMeta } from "./TerminalActorGroup";
import type { TerminalActorOption } from "./TerminalGrantManagerDialog";

if (typeof customElements !== "undefined" && !customElements.get(TERMINAL_VIEW_TAG)) {
  class TerminalViewStoryStubElement extends HTMLElement {
    #terminalId = "";
    #terminalTitle = "";
    #cwd = "";
    #status = "";
    #viewportMode = "";
    #transportUrl = "";

    connectedCallback() {
      this.dataset.connected = "true";
    }

    get terminalId() {
      return this.#terminalId;
    }
    set terminalId(value: string) {
      this.#terminalId = value;
      this.dataset.terminalId = value;
    }

    get terminalTitle() {
      return this.#terminalTitle;
    }
    set terminalTitle(value: string) {
      this.#terminalTitle = value;
      this.dataset.terminalTitle = value;
    }

    get cwd() {
      return this.#cwd;
    }
    set cwd(value: string) {
      this.#cwd = value;
      this.dataset.cwd = value;
    }

    get status() {
      return this.#status;
    }
    set status(value: string) {
      this.#status = value;
      this.dataset.status = value;
    }

    get viewportMode() {
      return this.#viewportMode;
    }
    set viewportMode(value: string) {
      this.#viewportMode = value;
      this.dataset.viewportMode = value;
    }

    get transportUrl() {
      return this.#transportUrl;
    }
    set transportUrl(value: string) {
      this.#transportUrl = value;
      this.dataset.transportUrl = value;
    }
  }
  customElements.define(TERMINAL_VIEW_TAG, TerminalViewStoryStubElement);
}

const actorOptions: TerminalActorOption[] = [
  {
    actorId: "session:owner",
    actorKind: "session",
    label: "Owner avatar",
    subtitle: "/repo/demo",
  },
  {
    actorId: "session:reviewer",
    actorKind: "session",
    label: "Reviewer avatar",
    subtitle: "/repo/review",
  },
  {
    actorId: "session:viewer",
    actorKind: "session",
    label: "Viewer avatar",
    subtitle: "/repo/watch",
  },
];

const actorMeta = new Map<string, TerminalActorMeta>(
  actorOptions.map((option) => [option.actorId, { label: option.label, subtitle: option.subtitle }]),
);

const terminals: GlobalTerminalEntry[] = [
  {
    terminalId: "iflow",
    processKind: "shell",
    command: ["bash", "-i"],
    cwd: "/repo/demo",
    workspace: "/repo/demo",
    running: true,
    status: "BUSY",
    seq: 4,
    focused: true,
    title: "Flow shell",
    shortcuts: { submit: "enter", plan: "shift+tab" },
    rendererEngine: "xterm",
    transportUrl: "ws://127.0.0.1:4020/pty/iflow?token=termtok_owner",
    currentAdminId: "session:owner",
    approvalTimeoutMs: 90_000,
    pendingRequestCount: 1,
    access: {
      role: "admin",
      accessToken: "termtok_owner",
      participantId: "session:owner",
      currentAdmin: true,
      adminCandidateRank: 0,
    },
    actors: [
      {
        actorId: "session:owner",
        role: "admin",
        currentAdmin: true,
        adminCandidateRank: 0,
        online: true,
        focused: true,
      },
      {
        actorId: "session:reviewer",
        role: "requester",
        online: true,
        focused: false,
        currentAdmin: false,
      },
      {
        actorId: "session:viewer",
        role: "readonly",
        online: false,
        focused: false,
        currentAdmin: false,
        invalidCredential: true,
      },
    ],
  },
  {
    terminalId: "review",
    processKind: "shell",
    command: ["bash", "-i"],
    cwd: "/repo/review",
    workspace: "/repo/review",
    running: true,
    status: "IDLE",
    seq: 2,
    focused: false,
    title: "Review shell",
    shortcuts: {},
    rendererEngine: "xterm",
    transportUrl: "ws://127.0.0.1:4020/pty/review?token=termtok_review",
    currentAdminId: "session:owner",
    approvalTimeoutMs: 90_000,
    pendingRequestCount: 0,
    access: {
      role: "admin",
      accessToken: "termtok_owner",
      participantId: "session:owner",
      currentAdmin: true,
      adminCandidateRank: 0,
    },
    actors: [
      {
        actorId: "session:owner",
        role: "admin",
        currentAdmin: true,
        adminCandidateRank: 0,
        online: true,
        focused: false,
      },
    ],
  },
];

const grants: GlobalTerminalGrantEntry[] = [
  {
    grantId: "grant-owner",
    terminalId: "iflow",
    role: "admin",
    label: "Owner avatar",
    participantId: "session:owner",
    accessToken: "termtok_owner",
    createdAt: 1,
  },
  {
    grantId: "grant-reviewer",
    terminalId: "iflow",
    role: "requester",
    label: "Reviewer avatar",
    participantId: "session:reviewer",
    accessToken: "termtok_reviewer",
    createdAt: 2,
  },
];

const approvalRequests: GlobalTerminalApprovalRequest[] = [
  {
    requestId: "approval-1",
    terminalId: "iflow",
    participantId: "session:reviewer",
    assignedAdminId: "session:owner",
    createdAt: 1,
    expiresAt: 90_000,
    status: "pending",
    requestedInput: {
      text: "npm run lint\n",
      submit: false,
      submitKey: "enter",
    },
  },
];

const activity: TerminalActivityItem[] = [
  {
    id: 1,
    terminalId: "iflow",
    createdAt: 1,
    actorId: "session:owner",
    kind: "terminal_write",
    cycleId: null,
    title: "Terminal write",
    content: "npm run lint\n",
  },
  {
    id: 2,
    terminalId: "iflow",
    createdAt: 2,
    actorId: "session:owner",
    kind: "terminal_read",
    cycleId: null,
    title: "terminal_read",
    content: "lint completed",
  },
];

const meta = {
  title: "Features/Terminal/GlobalTerminalWorkbench",
  component: GlobalTerminalWorkbench,
  args: {
    terminals,
    selectedTerminalId: "iflow",
    loading: false,
    refreshing: false,
    error: null,
    viewportMode: "fit" as const,
    actorOptions,
    callerOptions: [
      { accessToken: "termtok_owner", label: "Owner avatar", subtitle: "/repo/demo", roleLabel: "admin" },
      { accessToken: "termtok_reviewer", label: "Reviewer avatar", subtitle: "/repo/review", roleLabel: "requester" },
    ],
    selectedCallerToken: "termtok_owner",
    resolveActorMeta: (actorId: string) => actorMeta.get(actorId) ?? null,
    activity: {
      terminalId: "iflow",
      items: activity,
      hasMore: true,
      loading: false,
      loadingMore: false,
    },
    grants: {
      terminalId: "iflow",
      items: grants,
      loading: false,
      error: null,
    },
    users: [
      {
        actorId: "session:owner",
        actorKind: "session",
        label: "Owner avatar",
        subtitle: "/repo/demo",
        role: "admin",
        currentAdmin: true,
        online: true,
        focused: true,
        invalidCredential: false,
        accessToken: "termtok_owner",
        currentCaller: true,
      },
      {
        actorId: "session:reviewer",
        actorKind: "session",
        label: "Reviewer avatar",
        subtitle: "/repo/review",
        role: "requester",
        currentAdmin: false,
        online: true,
        focused: false,
        invalidCredential: false,
        accessToken: "termtok_reviewer",
        currentCaller: false,
      },
    ],
    onRefresh: fn(async () => {}),
    onSelectCallerToken: fn((accessToken: string) => accessToken),
    onSelectTerminal: fn((terminalId: string) => terminalId),
    onSetViewportMode: fn((mode: "fit" | "cover") => mode),
    onCreateTerminal: fn(async () => ({ ok: true, message: "created", terminal: terminals[0] })),
    onDeleteTerminal: fn(async () => ({ ok: true, message: "deleted" })),
    onListGrants: fn(async () => grants),
    onIssueGrant: fn(async (): Promise<GlobalTerminalGrantIssueOutput["grant"]> => ({
      grantId: "grant-new",
      terminalId: "iflow",
      role: "readonly",
      label: "Viewer avatar",
      participantId: "session:viewer",
      accessToken: "termtok_viewer",
      createdAt: 3,
      currentAdmin: false,
    })),
    onRevokeGrant: fn(async () => ({ ok: true })),
    onListApprovalRequests: fn(async () => approvalRequests),
    onApproveRequest: fn(async () => ({})),
    onDenyRequest: fn(async () => ({})),
    onLoadMoreActivity: fn(async () => {}),
    onSetUserFocus: fn(async () => {}),
    onReadTerminal: fn(async () => {}),
    onWriteTerminal: fn(async () => {}),
  },
  render: (args) => {
    const [selectedTerminalId, setSelectedTerminalId] = useState(args.selectedTerminalId);
    const [viewportMode, setViewportMode] = useState<"fit" | "cover">(args.viewportMode);

    return (
      <div className="h-[760px] w-[min(1200px,100vw)] p-6">
        <GlobalTerminalWorkbench
          {...args}
          selectedTerminalId={selectedTerminalId}
          viewportMode={viewportMode}
          onSelectTerminal={(terminalId) => {
            args.onSelectTerminal(terminalId);
            setSelectedTerminalId(terminalId);
          }}
          onSetViewportMode={(mode) => {
            args.onSetViewportMode(mode);
            setViewportMode(mode);
          }}
        />
      </div>
    );
  },
} satisfies Meta<typeof GlobalTerminalWorkbench>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WorkbenchLifecycle: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const body = within(document.body);
    await expect(canvas.getByRole("button", { name: "Create terminal" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Access" })).toBeInTheDocument();
    await expect(canvas.getByRole("button", { name: "Approvals 1" })).toBeInTheDocument();
    await expect(canvas.getByRole("heading", { name: "Flow shell" })).toBeInTheDocument();
    await expect(canvas.queryByRole("button", { name: "Focus terminal" })).toBeNull();
    await expect(canvas.queryByRole("button", { name: "Clear focus" })).toBeNull();

    await waitFor(() => {
      expect(canvasElement.querySelector("terminal-view")).not.toBeNull();
    });
    const terminalView = canvasElement.querySelector("terminal-view") as HTMLElement | null;
    await expect(terminalView?.dataset.terminalId).toBe("iflow");
    await expect(terminalView?.dataset.viewportMode).toBe("fit");

    await userEvent.click(canvas.getByRole("button", { name: "Cover viewport" }));
    await waitFor(() => {
      expect(terminalView?.dataset.viewportMode).toBe("cover");
    });

    await userEvent.click(canvas.getByRole("tab", { name: /Review shell/i }));
    await expect(args.onSelectTerminal).toHaveBeenCalledWith("review");
    await waitFor(() => {
      expect(terminalView?.dataset.terminalId).toBe("review");
    });

    await userEvent.click(canvas.getByRole("tab", { name: /Flow shell/i }));
    await userEvent.click(canvas.getByRole("tab", { name: "Users" }));
    await userEvent.click(canvas.getByRole("button", { name: "Unfocus Owner avatar" }));
    await expect(args.onSetUserFocus).toHaveBeenCalledWith({
      actorId: "session:owner",
      accessToken: "termtok_owner",
      focused: true,
    });

    await userEvent.click(canvas.getByRole("tab", { name: "Actions" }));
    await userEvent.click(canvas.getByRole("button", { name: "Access" }));
    await expect(await body.findByText("Current grants")).toBeInTheDocument();
    await expect(args.onListGrants).toHaveBeenCalled();

    await userEvent.click(body.getByRole("button", { name: "Close dialog" }));
    await userEvent.click(canvas.getByRole("button", { name: "Approvals 1" }));
    await expect(await body.findByText(/Pending approvals for Flow shell/i)).toBeInTheDocument();
    await expect((await body.findAllByText("npm run lint")).length).toBeGreaterThan(0);
    await expect(args.onListApprovalRequests).toHaveBeenCalled();
  },
};

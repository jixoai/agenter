import type { AttentionQueryItem } from "@agenter/client-sdk";
import { ensureShellNextAuthenticated } from "./auth";
import type { ShellNextRoomBootstrapResult } from "./bootstrap";
import {
  cleanupShellNextResources,
  formatShellNextCleanupResult,
  hasShellNextCleanupFailures,
} from "./cleanup";
import type { ShellNextKeybindings, ShellNextSettings } from "../product-room/settings";

import type { ShellNextAppInput } from "../app/shell-next-app";
import type { PaneSource } from "../renderable-mux/pane-source";
import { createShellNextRuntimeApprovalStore } from "./approval-store";
import type {
  ShellNextAttachArgs,
  ShellNextCleanupArgs,
} from "./argv";
import {
  defaultShellNextProductRunDependencies,
  type ShellNextProductRunDependencies,
  type ShellNextRuntimeStore,
} from "./runtime-dependencies";

export { defaultShellNextProductRunDependencies } from "./runtime-dependencies";
export type { ShellNextProductRunDependencies } from "./runtime-dependencies";

export interface ShellNextProductRunResult {
  readonly exitCode: number;
}

const formatCreatedState = (created: boolean): string => (created ? "created" : "reused");

const attentionSummary = (items: readonly AttentionQueryItem[]): NonNullable<ShellNextAppInput["initialStatus"]>["attention"] => {
  let focused = 0;
  let background = 0;
  let muted = 0;
  for (const item of items) {
    const focusState = item.context.focusState;
    if (focusState === "focused") {
      focused += 1;
    } else if (focusState === "muted") {
      muted += 1;
    } else {
      background += 1;
    }
  }
  return { focused, background, muted };
};

const ensureAttachSelection = async (
  input: {
    args: ShellNextAttachArgs;
    store: ShellNextRuntimeStore;
    settings: ShellNextSettings;
    tty: boolean;
  },
  dependencies: ShellNextProductRunDependencies,
): Promise<{
  args: ShellNextAttachArgs;
  settings: ShellNextSettings;
}> => {
  if (input.args.sessionExplicit && input.args.avatarExplicit) {
    return { args: input.args, settings: input.settings };
  }
  if (!input.tty) {
    throw new Error("shell-next requires --session and --avatar when stdin/stdout is not a TTY");
  }
  await ensureShellNextAuthenticated(input.store);
  const selection = await dependencies.startNavigationTui({
    store: input.store,
    settings: input.settings,
    needsShell: !input.args.sessionExplicit,
    needsAvatar: !input.args.avatarExplicit,
    initialShellName: input.args.sessionExplicit ? input.args.shellName : undefined,
    initialAvatarNickname: input.args.avatarExplicit ? input.args.avatarNickname : undefined,
  });
  const nextArgs = {
    ...input.args,
    shellName: input.args.sessionExplicit ? input.args.shellName : selection.shellName,
    avatarNickname: input.args.avatarExplicit ? input.args.avatarNickname : selection.avatarNickname,
    createAvatar: input.args.createAvatar || selection.createAvatar,
    sessionExplicit: true,
    avatarExplicit: true,
  };
  const nextSettings: ShellNextSettings = {
    ...input.settings,
    startup: {
      lastShellName: nextArgs.shellName,
      lastAvatarNickname: nextArgs.avatarNickname,
    },
  };
  await dependencies.saveSettings(nextSettings);
  return {
    args: nextArgs,
    settings: nextSettings,
  };
};

const createAttachedTerminalSourcePolicy = (input: {
  attached: ShellNextRoomBootstrapResult;
  dependencies: ShellNextProductRunDependencies;
}): NonNullable<ShellNextAppInput["terminalSourcePolicy"]> => {
  return {
    createInitialSource: (sourceInput): PaneSource => {
    const terminalId = input.attached.terminal.entry.terminalId;
    const transportUrl = input.attached.terminal.entry.transportUrl;
    if (!transportUrl) {
      throw new Error(`attached terminal missing transportUrl: ${terminalId}`);
    }
    return input.dependencies.createLiveTerminalSource({
      id: sourceInput.id,
      terminalId,
      transportUrl,
      initialSnapshot: input.attached.terminal.entry.snapshot ?? null,
      initialTitle:
        input.attached.terminal.entry.currentTitle ??
        input.attached.terminal.entry.configuredTitle ??
        input.attached.terminal.entry.terminalId,
      configuredTitle: input.attached.terminal.entry.configuredTitle ?? null,
      currentTitle: input.attached.terminal.entry.currentTitle ?? null,
    });
    },
    describeSplitUnavailable: () => "Product-bound terminal split is not implemented",
  };
};

const buildInitialStatus = async (input: {
  store: ShellNextRuntimeStore;
  attached: ShellNextRoomBootstrapResult;
  dependencies: ShellNextProductRunDependencies;
}): Promise<NonNullable<ShellNextAppInput["initialStatus"]>> => {
  const heartbeat = await input.dependencies.readHeartbeatStatus({
    store: input.store,
    runtimeSessionId: input.attached.session.id,
    shellName: input.attached.binding.resourceKey,
  });
  const attention = await input.store
    .queryAttention({
      sessionId: input.attached.session.id,
      query: "minscore:0",
    })
    .then(attentionSummary)
    .catch(() => ({
      focused: 0,
      background: 0,
      muted: 0,
    }));
  return {
    runtime: { label: heartbeat.startsWith("Idle") ? "Idle" : heartbeat },
    attention,
    actions: ["Help", "Chat"],
  };
};

const writeAttachSummary = (
  attached: ShellNextRoomBootstrapResult,
  stdout: Pick<NodeJS.WriteStream, "write">,
): void => {
  stdout.write(`shell-next attached\n`);
  stdout.write(`avatar: ${attached.avatar.nickname}\n`);
  stdout.write(`runtime: ${attached.avatar.runtimeId}\n`);
  stdout.write(`terminal: ${attached.terminal.entry.terminalId} (${formatCreatedState(attached.terminal.created)})\n`);
  stdout.write(`room: ${attached.room.entry.chatId} (${formatCreatedState(attached.room.created)})\n`);
  stdout.write(`managed: ${attached.managed.managed ? "on" : "off"}\n`);
};

const buildAttachedRoomInput = (input: {
  store: ShellNextRuntimeStore;
  attached: ShellNextRoomBootstrapResult;
  settings: ShellNextSettings;
  keybindings: ShellNextKeybindings;
}): NonNullable<ShellNextAppInput["room"]> => ({
  store: input.store,
  attached: input.attached,
  shellName: input.attached.binding.resourceKey,
  settings: input.settings,
  keybindings: input.keybindings,
});

const buildRootPaneForView = (view: ShellNextAttachArgs["view"]): NonNullable<ShellNextAppInput["rootPane"]> =>
  view === "none" || view === "shell"
    ? { id: "pane-1", sourceId: "source-1", sourceKind: "terminal-protocol" }
    : { id: "pane-1", sourceId: `view-${view}`, sourceKind: "opentui-renderable" };

export const runShellNextCleanup = async (
  args: ShellNextCleanupArgs,
  dependencies: ShellNextProductRunDependencies = defaultShellNextProductRunDependencies,
): Promise<ShellNextProductRunResult> => {
  const client = dependencies.createClient(args);
  try {
    const store = dependencies.createStore(client);
    const result = await cleanupShellNextResources(store, {
      shellName: args.shellName,
      confirm: args.confirm,
    });
    dependencies.stdout.write(formatShellNextCleanupResult(result));
    return { exitCode: hasShellNextCleanupFailures(result) ? 1 : 0 };
  } finally {
    client.close();
  }
};

export const runShellNextProductAttach = async (
  args: ShellNextAttachArgs,
  dependencies: ShellNextProductRunDependencies = defaultShellNextProductRunDependencies,
): Promise<ShellNextProductRunResult> => {
  const client = dependencies.createClient(args);
  try {
    const store = dependencies.createStore(client);
    const settings = await dependencies.readSettings();
    const selection = await ensureAttachSelection(
      {
        args,
        store,
        settings,
        tty: dependencies.stdinIsTty() && dependencies.stdoutIsTty(),
      },
      dependencies,
    );
    const keybindings = await dependencies.readKeybindings();
    const attached = await dependencies.bootstrapRoom({
      store,
      workspacePath: process.cwd(),
      avatarNickname: selection.args.avatarNickname,
      shellName: selection.args.shellName,
      createAvatar: selection.args.createAvatar,
      clearAvatar: selection.args.clearAvatar,
    });
    const status = await buildInitialStatus({ store, attached, dependencies });
    if (!dependencies.stdinIsTty() || !dependencies.stdoutIsTty()) {
      writeAttachSummary(attached, dependencies.stdout);
      return { exitCode: 0 };
    }
    await store.connect();
    const app = await dependencies.startApp({
      rootPane: buildRootPaneForView(args.view),
      terminalSourcePolicy: createAttachedTerminalSourcePolicy({
        attached,
        dependencies,
      }),
      approvalStore: createShellNextRuntimeApprovalStore({
        store,
        terminalId: attached.terminal.entry.terminalId,
      }),
      room: buildAttachedRoomInput({ store, attached, settings: selection.settings, keybindings }),
      initialStatus: status,
      showStatusbar: args.view === "none",
      syncStatusbarWithLayout: false,
      initialSurfaces: args.view === "none" ? [] : [],
      showTopLayer: false,
    });
    try {
      await app.finished;
    } finally {
      store.disconnect();
    }
    return { exitCode: 0 };
  } finally {
    client.close();
  }
};
